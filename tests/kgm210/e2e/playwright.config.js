'use strict';
const path=require('path');
const {defineConfig,devices}=require('@playwright/test');

module.exports=defineConfig({
  testDir:'.',
  testMatch:'weekly-journey-v315.spec.js',
  timeout:90000,
  expect:{timeout:12000},
  fullyParallel:false,
  retries:0,
  reporter:[['list'],['html',{outputFolder:'playwright-report',open:'never'}]],
  use:{
    baseURL:'http://127.0.0.1:4173',
    trace:'retain-on-failure',
    screenshot:'only-on-failure',
    video:'retain-on-failure'
  },
  projects:[{
    name:'mobile-chromium',
    use:{...devices['Pixel 5']}
  }],
  webServer:{
    command:'python3 -m http.server 4173 --bind 127.0.0.1',
    cwd:path.resolve(__dirname,'../../..'),
    url:'http://127.0.0.1:4173/tests/kgm210/index.html',
    timeout:120000,
    reuseExistingServer:true
  }
});