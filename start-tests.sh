#!/bin/bash

###############################################################################
# Copyright (c) 2020 Red Hat, Inc.
###############################################################################
echo "Initiating Search E2E tests..."

section_title () {
  printf "\n$(tput bold)$1 $(tput sgr0)\n"
}

if [ -z "$BROWSER" ]; then
  echo "BROWSER not exported; setting to 'chrome' (options available: 'chrome', 'firefox')"
  export BROWSER="chrome"
fi

# Load test config mounted at /resources/options.yaml
OPTIONS_FILE=/resources/options.yaml
USER_OPTIONS_FILE=./options.yaml

if [ -f $OPTIONS_FILE ]; then
  echo "Using test config from: $OPTIONS_FILE"
  export CYPRESS_OPTIONS_HUB_BASEDOMAIN=`yq e '.options.hub.baseDomain' $OPTIONS_FILE`
  export CYPRESS_OPTIONS_HUB_USER=`yq e '.options.hub.user' $OPTIONS_FILE`
  export CYPRESS_OPTIONS_HUB_PASSWORD=`yq e '.options.hub.password' $OPTIONS_FILE`
  export OPTIONS_HUB_BASEDOMAIN=`yq e '.options.hub.baseDomain' $OPTIONS_FILE`
  export OPTIONS_HUB_USER=`yq e '.options.hub.user' $OPTIONS_FILE`
  export OPTIONS_HUB_PASSWORD=`yq e '.options.hub.password' $OPTIONS_FILE`
elif [ -f $USER_OPTIONS_FILE ]; then
  echo "Using test config from: $USER_OPTIONS_FILE"
  export CYPRESS_OPTIONS_HUB_BASEDOMAIN=`yq e '.options.hub.baseDomain' $USER_OPTIONS_FILE`
  export CYPRESS_OPTIONS_HUB_USER=`yq e '.options.hub.user' $USER_OPTIONS_FILE`
  export CYPRESS_OPTIONS_HUB_PASSWORD=`yq e '.options.hub.password' $USER_OPTIONS_FILE`
  export OPTIONS_HUB_BASEDOMAIN=`yq e '.options.hub.baseDomain' $USER_OPTIONS_FILE`
  export OPTIONS_HUB_USER=`yq e '.options.hub.user' $USER_OPTIONS_FILE`
  export OPTIONS_HUB_PASSWORD=`yq e '.options.hub.password' $USER_OPTIONS_FILE`
else
  echo -e "Options file does not exist, using test config from environment variables.\n"
fi

export CYPRESS_BASE_URL=https://multicloud-console.apps.$CYPRESS_OPTIONS_HUB_BASEDOMAIN

echo -e "Running tests with the following environment:\n"
echo -e "\tCYPRESS_OPTIONS_HUB_BASEDOMAIN : $CYPRESS_OPTIONS_HUB_BASEDOMAIN"
echo -e "\tCYPRESS_OPTIONS_HUB_BASE_URL   : $CYPRESS_BASE_URL"
echo -e "\tCYPRESS_OPTIONS_HUB_USER       : $CYPRESS_OPTIONS_HUB_USER"

echo -e "\nLogging into Kube API server\n"
oc login --server=https://api.${CYPRESS_OPTIONS_HUB_BASEDOMAIN}:6443 -u $CYPRESS_OPTIONS_HUB_USER -p $CYPRESS_OPTIONS_HUB_PASSWORD --insecure-skip-tls-verify

testCode=0

# We are caching the cypress binary for containerization, therefore it does not need npx. However, locally we need it.
HEADLESS="--headless"
if [[ "$LIVE_MODE" == true ]]; then
  HEADLESS=""
fi

if [ -z "$NODE_ENV" ]; then
  export NODE_ENV="production" || set NODE_ENV="production"
fi

if [ -z "$SKIP_API_TEST" ]; then
  echo -e "SKIP_API_TEST not exported; setting to false (set SKIP_API_TEST to true, if you wish to skip the API tests)"
  export SKIP_API_TEST=false
fi

if [ -z "$SKIP_UI_TEST" ]; then
  echo -e "SKIP_UI_TEST not exported; setting to false (set SKIP_UI_TEST to true, if you wish to skip the UI tests)\n"
  export SKIP_UI_TEST=false
fi

echo -e "Setting env to run in: $NODE_ENV"

if [ "$SKIP_API_TEST" == false ]; then
  section_title "Running Search API tests."
  npm run test:api
else
  echo -e "\nSKIP_API_TEST was set to true. Skipping API tests"
fi

if [ "$SKIP_UI_TEST" == false ]; then
  section_title "Running Search UI tests."
  if [ "$NODE_ENV" == "development" ]; then
    npx cypress run --browser $BROWSER $HEADLESS --spec "./tests/cypress/tests/*.spec.js" --reporter cypress-multi-reporters --env NODE_ENV=$NODE_ENV
  elif [ "$NODE_ENV" == "debug" ]; then
    npx cypress open --browser $BROWSER --config numTestsKeptInMemory=0 --env NODE_ENV=$NODE_ENV
  else
    cypress run --browser $BROWSER $HEADLESS --spec "./tests/cypress/tests/*.spec.js" --reporter cypress-multi-reporters --env NODE_ENV=$NODE_ENV
  fi
else
  echo -e "SKIP_UI_TEST was set to true. Skipping UI tests\n"
fi

testCode=$?

if [[ "$SKIP_UI_TEST" == false && "$SKIP_API_TEST" == false ]]; then
  section_title "Merging XML and JSON reports..."
  npm run test:merge-reports
  ls -R results
fi

exit $testCode