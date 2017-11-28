/**

The MIT License (MIT)

Copyright (c) 2015 Steven Campbell.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

 */

"use strict";

import axios from 'axios/dist/axios.min.js'
import { ChromePromiseApi } from '$lib/chrome-api-promise.js'

const chromePromise = ChromePromiseApi()

function OneDriveFileManager (settings) {
  var accessTokenType = 'onedrive';

  var exports = {
    key: 'onedrive',
    routePath: '/onedrive',
    listDatabases: listDatabases,
    getDatabaseChoiceData: getDatabaseChoiceData,
    getChosenDatabaseFile: getChosenDatabaseFile,
    supportedFeatures: ['listDatabases'],
    title: 'OneDrive',
    icon: 'icon-onedrive',
    chooseTitle: 'OneDrive',
    chooseDescription: 'Access password files stored on OneDrive.  Files will be retrieved from OneDrive each time they are used.',
    login: authorize,
    logout: revokeAuth,
    isLoggedIn: isAuthorized
  };

  function ensureOriginPermissions() {
    var dropboxOrigins = ['https://login.live.com/'];
    return chromePromise.permissions.contains({origins: dropboxOrigins}).then(function() {
      return true;
    }).catch(function() {
      return chromePromise.permissions.request({origins: dropboxOrigins}).then(function() {
        return true;
      }).catch(function(err) {
        return false;
      })
    });
  }

  function isAuthorized () {
    return settings.getAccessToken(accessTokenType).then(function (token) {
      return token != null;
    });
  }

  function authorize () {
    console.log("Wooo")
    var resolve, reject;
    let returnPromise = new Promise((resolvep, rejectp) => {
      resolve = resolvep;
      reject = rejectp;
    })
    var url = 'https://login.live.com/oauth20_authorize.srf' +
            '?client_id=f4c55645-3f43-4f8e-a7d2-ec167b416f1d' +
            '&scope=' + encodeURIComponent('onedrive.readonly') +
            '&response_type=token' +
            '&redirect_uri=' + encodeURIComponent(chrome.identity.getRedirectURL('onedrive'));

    chromePromise.identity.launchWebAuthFlow({url: url, interactive: true}).then(function (redirectUrl) {
      var authInfo = parseAuthInfoFromUrl(redirectUrl);
      if (authInfo === null) {
        reject('Failed to extract authentication information from redirect url');
      } else {
        settings.saveAccessToken(accessTokenType, authInfo.access_token);
        resolve();
      }
    });
    return returnPromise;
  }

  function listDatabases () {
    return getToken()
      .then(searchFiles)
      .then(filterFiles);
  }

  function searchFiles (token) {
    console.log('searchFiles', token)
    // there is no proper way of searching for file-extensions right now (?), so we search for files containing kdb and filter ourselves afterwards
    var query = encodeURIComponent('kdb');
    var filter = encodeURIComponent('file ne null');
    var url = 'https://api.onedrive.com/v1.0/drive/root/view.search?q=' + query + '&filter=' + filter;
    return axios({ 
      method: 'GET', 
      url: url, 
      headers: { 
        Authorization: 'Bearer ' + token 
      }
    }).catch(function (error) {
      console.log("CASE initiated", error)
      // token expired
      if (error.response.status && error.response.status == 401) {
        return authorize()
          .then(getToken)
          .then(searchFiles)
      } else {
        console.error(error);
      }
    })
  }

  function filterFiles (response) {
    if (!response) {
      return Promise.reject('Unable to get a response from OneDrive');
    }
    if (!response.data.value) {
      return Promise.reject('Unexpected response from OneDrive API');
    }

    // only return files that have a .kdb or .kdbx extension
    var files = response.data.value.filter(function (file) {
      return file.name && /\.kdbx?$/.exec(file.name);
    });

    return files.map(transformFile);
  }

  function parseAuthInfoFromUrl (url) {
    var hash = /#(.+)$/.exec(url);
    if (!hash) {
      return null;
    }

    hash = hash[1];
    return JSON.parse('{"' + hash.replace(/&/g, '","').replace(/=/g, '":"') + '"}', function(key, value) {
      return key === "" ? value : decodeURIComponent(value);
    });
  }

  function transformFile (file) {
    var path = "";
    if (file.parentReference) {
      // path will be e.g. "/drive/root:/Documents"
      path = file.parentReference.path;

      // extract the part after the colon, so "/Documents"
      var split = /:(.+)$/.exec(path);
      if (split) {
        path = split[1];
      }

      if (!/\/$/.exec(path)) {
        // append trailing slash, if there was none
        path += "/";
      }
    }

    return {
      url: file['@content.downloadUrl'],
      title: path + file.name
    }
  }

  //get the minimum information needed to identify this file for future retrieval
  function getDatabaseChoiceData(dbInfo) {
    return {
      url: dbInfo.url,
      title: dbInfo.title
    };
  }

  //given minimal file information, retrieve the actual file
  function getChosenDatabaseFile(dbInfo) {
    return getToken()
      .then(function (token) {
        return loadFile(dbInfo, token);
      })
      .then(function (response) {
        return response.data;
      })
      .catch(function (response) {
        // token expired
        if (response.status && response.status == 401) {
          return authorize().then(function () {
            return getChosenDatabaseFile(dbInfo);
          });
        }
      });
  }

  function loadFile (dbInfo, token) {
    var id = encodeURIComponent(dbInfo.id);
    return axios({
      method: 'GET',
      url: dbInfo.url,
      responseType: 'arraybuffer',
      headers: {
        Authorization: 'Bearer ' + token
      }
    });
  }

  function revokeAuth () {
    return ensureOriginPermissions().then(nil => {
      return axios.get('https://login.live.com/oauth20_logout.srf?client_id=f4c55645-3f43-4f8e-a7d2-ec167b416f1d')
      .then(response => {
        if (response.status == 200){
          settings.saveAccessToken(accessTokenType, null);
          console.info("You have logged out of OneDrive")
          return;
        } else {
          console.error("Could not log out of Onedrive, ", response)
        }
      })
    })
  }

  function getToken () {
    return settings.getAccessToken(accessTokenType).then(function (token) {
      if (!token) {
        return Promise.reject('No access token available. Did you authorize yet?');
      }
      return token;
    });
  }

  return exports;
}

export { OneDriveFileManager }