// Copyright (c) 2020 Red Hat, Inc.

const { exec } = require("child_process");

const execCLI = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error.message);
      }
      if (stderr) {
        reject(stderr);
      }
      resolve(stdout.substr(0, stdout.lastIndexOf('\n')));
    });
  })
}

module.exports = execCLI