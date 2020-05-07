/*******************************************************************************
 * Licensed Materials - Property of IBM
 * (c) Copyright IBM Corporation 2018. All Rights Reserved.
 *
 * Note to U.S. Government Users Restricted Rights:
 * Use, duplication or disclosure restricted by GSA ADP Schedule
 * Contract with IBM Corp.
 *******************************************************************************/
// Copyright (c) 2020 Red Hat, Inc.

const execCLI = require('./cliHelper');
const getKubeToken = require('./tokenHelper');
const { kubeRequest } = require('./requestClient');

let kubeToken = null;
const namespaceName = `e2e-test-${Date.now()}`
process.env.NODE_TLS_REJECT_UNAUTHORIZED='0'

const sleep = (milliseconds) => {
  const date = Date.now();
  let currentDate = null;
  do {
    currentDate = Date.now();
  } while (currentDate - date < milliseconds)
}

/* eslint-disable no-console*/
module.exports = {
  // External before hook is run at the beginning of the tests run, before creating the Selenium session
  before: async function(done) {
    kubeToken = await getKubeToken();

    // Check if user password secret exists, if not create it.
    const userSecretCheck = await execCLI(`oc get secret search-e2e-secret -n openshift-config`)
    if (userSecretCheck.includes('Command failed') || userSecretCheck.includes('Error')) {
      console.log('Creating Oauth Provider secret')
      await execCLI(`oc create secret generic search-e2e-secret --from-file=htpasswd=./tests/utils/kube-resources/passwdfile -n openshift-config`)
      console.log('Success: Created Oauth Provider secret')
    }

    // Check if cluster OAuth resource has the e2e testing identity provider, if not add it.
    const oauthCheck = await kubeRequest(`/apis/config.openshift.io/v1/oauths/cluster`, 'get', {}, kubeToken)
    if (oauthCheck && !oauthCheck.spec.identityProviders) {
      console.log('Adding e2e identity provider')
      await execCLI(`oc patch OAuth cluster --type='json' -p='[{"op": "add", "path": "/spec", "value": {"identityProviders":[{"htpasswd":{"fileData":{"name":"search-e2e-secret"}},"mappingMethod":"claim","name":"search-e2e","type": "HTPasswd"}]}}]'`)
      console.log('Success: Adding e2e identity provider')
    } else if (oauthCheck && oauthCheck.spec.identityProviders.findIndex(provider => provider.name === 'search-e2e') === -1) {
      console.log('Adding e2e identity provider')
      await execCLI(`oc patch OAuth cluster --type='json' -p='[{"op": "add", "path": "/spec/identityProviders/-", "value": {"htpasswd":{"fileData":{"name":"search-e2e-secret"}},"mappingMethod":"claim","name":"search-e2e","type": "HTPasswd"}}]'`)
      console.log('Success: Adding e2e identity provider')
    }

    // Check if viewer ClusterRole exists, if not create it.
    const roleCheck = await execCLI(`oc get clusterrole view`)
    if (roleCheck.includes('Command failed') || roleCheck.includes('Error')) {
      console.log('Creating cluster role - viewer')
      await execCLI(`oc apply -f ./tests/utils/kube-resources/viewer-role.yaml`)
      console.log('Success: Creating cluster role - viewer')
    }

    // Check if viewer ClusterRoleBinding exists, if not create it.
    const roleBindingCheck = await execCLI(`oc get clusterrolebinding viewer-binding`)
    if (roleBindingCheck.includes('Command failed') || roleBindingCheck.includes('Error')) {
      console.log('Creating cluster role binding - viewer')
      await execCLI(`oc apply -f ./tests/utils/kube-resources/viewer-roleBinding.yaml`)
      console.log('Success: Creating cluster role binding- viewer')
    } else {
      const viewerBinding = await kubeRequest(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/viewer-binding`, 'get', {}, kubeToken)
      if (!viewerBinding.subjects || viewerBinding.subjects.findIndex(subject => subject.name === 'user-viewer') === -1) {
        viewerBinding.subjects = [
          {
            "kind": "User",
            "apiGroup": "rbac.authorization.k8s.io",
            "name": "user-viewer"
          },
          ...viewerBinding.subjects || []
        ]
        await kubeRequest(`/apis/rbac.authorization.k8s.io/v1/clusterrolebindings/viewer-binding`, 'put', viewerBinding, kubeToken)
        console.log('Success: Adding new user to role binding')
      }
    }

    // Create test namespace
    await kubeRequest(
      '/api/v1/namespaces',
      'post',
      {
        "apiVersion": "v1",
        "kind": "Namespace",
        "metadata": {
          "name": namespaceName,
          "labels": {
            "name": "Namespace-4-e2e-testing"
          }
        }
      },
      kubeToken
    )
    console.log('Success: Created test namespace')
    
    // create secret on test namespace
    await kubeRequest(
      `/api/v1/namespaces/${namespaceName}/secrets`,
      'post',
      {
        "apiVersion": "v1",
        "kind": "Secret",
        "metadata": {
          "name": "my-test-secret"
        },
        "type": "Opaque",
        "data": {
          "username": "YWRtaW4="
        }
      },
      kubeToken
    )
    console.log('Success: Created test secret')

    // create configmap on test namespace
    await kubeRequest(
      `/api/v1/namespaces/${namespaceName}/configmaps`,
      'post',
      {
        "apiVersion": "v1",
        "kind": "ConfigMap",
        "metadata": {
          "name": "my-test-config",
          "namespace": `${namespaceName}`
        },
      },
      kubeToken
    )
    console.log('Success: Created test configmap')

    // Need to pause after Rbac creation so resources are able to be used.
    sleep(30000)
    done();
  },

  // External after hook is run at the very end of the tests run, after closing the Selenium session
  after: async function(done) {

    // Remove test namespace & resources (Keep the Oauth provider & users)
    await kubeRequest(
      `/api/v1/namespaces/${namespaceName}`,
      'delete',
      {},
      kubeToken
    )
    console.log('Success: Removing test namespace')

    done()
  },

  // This will be run before each test suite is started
  beforeEach: function(browser, done) {
    done()
  },

  // This will be run after each test suite is finished
  afterEach: function(browser, done) {
    done()
  }
}
