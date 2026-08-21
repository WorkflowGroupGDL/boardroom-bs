// index.js (En la raíz de auth-system)
const express = require('express');
const serverless = require('serverless-http');
const app = require('./server.js'); // O exporta tu app de express desde server.js

module.exports.handler = serverless(app);

