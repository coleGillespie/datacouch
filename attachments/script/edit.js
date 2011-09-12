var app = {
  baseURL: util.getBaseURL(window.location.href),
  container: 'main_content',
  emitter: util.registerEmitter()
};

app.handler = function(route) {
  if (route.params && route.params.id) {
    var path = route.params.route;
    app.routes['recline'](route.params.id);
  } else {
    app.routes['noID']();
  }  
};

app.routes = {
  pages: {
    dataset: function(id) {
      $('.homeButton').attr('href', app.baseURL);
      recline.bootstrap(id);
    },
    noID: function() {
      alert('you have to specify an id!');
    }
  },
  modals: {
    browse: function() {
      couch.request({url: app.baseURL + "api/apps"}).then(function(apps) {
        var appData = {apps: _(apps.rows).map(function(row) { 
          var appDoc = row.doc;
          return { 
            ddoc: appDoc.ddoc,
            screenshot: app.baseURL + "api/" + appDoc._id + '/screenshot.png'
          }
        })}
        recline.showDialog("appTemplates", appData);
      })
    }
  },
  tabs: {
    data: function() {
      util.render('dataTab', 'sidebar', util.formatProperties(app.datasetInfo))
      recline.initializeTable(app.offset);
    },
    apps: function() {
      util.render('appsTab', 'sidebar', util.formatProperties(app.datasetInfo))
    },
    history: function() {
      util.render('historyTab', 'sidebar')
    }
  }
}

app.after = {
  tableContainer: function() {
    recline.activateControls();
  },
  dataTable: function() {
    $('.column-header-menu').click(function(e) { 
      app.currentColumn = $(e.target).siblings().text();
      util.position('menu', e);
      util.render('columnActions', 'menu');
    });
    
    $('.row-header-menu').click(function(e) { 
      app.currentRow = $(e.target).parents('tr:first').attr('data-id');
      util.position('menu', e);
      util.render('rowActions', 'menu');
    });
    
    $('.data-table-cell-edit').click(function(e) {
      var editing = $('.data-table-cell-editor-editor');
      if (editing.length > 0) {
        editing.parents('.data-table-cell-value').html(editing.text()).siblings('.data-table-cell-edit').removeClass("hidden");
      }
      $(e.target).addClass("hidden");
      var cell = $(e.target).siblings('.data-table-cell-value');
      cell.data("previousContents", cell.text());
      util.render('cellEditor', cell, {value: cell.text()});
    })
  },
  columnActions: function() { recline.handleMenuClick() },
  rowActions: function() { recline.handleMenuClick() },
  cellEditor: function() {
    $('.data-table-cell-editor .okButton').click(function(e) {
      var cell = $(e.target);
      var rowId = cell.parents('tr').attr('data-id');
      var header = cell.parents('td').attr('data-header');
      var doc = _.find(app.cache, function(cacheDoc) {
        return cacheDoc._id === rowId;
      });
      doc[header] = cell.parents('.data-table-cell-editor').find('.data-table-cell-editor-editor').val();
      util.notify("Updating row...", {persist: true, loader: true});
      costco.updateDoc(doc).then(function(response) {
        util.notify("Row updated successfully");
        recline.initializeTable();
      })
    })
    $('.data-table-cell-editor .cancelButton').click(function(e) {
      var cell = $(e.target).parents('.data-table-cell-value');
      cell.html(cell.data('previousContents')).siblings('.data-table-cell-edit').removeClass("hidden");
    })
  },
  actions: function() {
    $('.button').click(function(e) { 
      var action = $(e.target).attr('data-action');
      util.position('menu', e, {left: -60, top: 5});
      util.render(action + 'Actions', 'menu');
      recline.handleMenuClick();
    });
  },
  controls: function() {
    $('#logged-in-status').click(function(e) { 
      if ($(e.target).text() === "Sign in") {
        recline.showDialog("signIn");
      } else if ($(e.target).text() === "Sign out") {
        util.notify("Signing you out...", {persist: true, loader: true});
        couch.logout().then(function(response) {
          util.notify("Signed out");
          util.render('controls', 'project-controls', {text: "Sign in"});
        })
      }
    });
  },
  signIn: function() {
    
    $('.dialog-content #username-input').focus();
    
    $('.dialog-content').find('#sign-in-form').submit(function(e) {
      $('.dialog-content .okButton').click();
      return false;
    })
    
    $('.dialog-content .okButton').click(function(e) {
      util.hide('dialog');
      util.notify("Signing you in...", {persist: true, loader: true});
      var form = $(e.target).parents('.dialog-content').find('#sign-in-form');
      var credentials = {
        name: form.find('#username-input').val(), 
        password: form.find('#password-input').val()
      }
      couch.login(credentials).then(function(response) {
        util.notify("Signed in");
        util.render('controls', 'project-controls', {text: "Sign out"});
      }, function(error) {
        if (error.statusText === "error") util.notify(JSON.parse(error.responseText).reason);
      })
    })
    
  },
  bulkEdit: function() {
    $('.dialog-content .okButton').click(function(e) {
      var funcText = $('.expression-preview-code').val();
      var editFunc = costco.evalFunction(funcText);
      ;
      if (editFunc.errorMessage) {
        util.notify("Error with function! " + editFunc.errorMessage);
        return;
      }
      util.hide('dialog');
      costco.updateDocs(editFunc);
    })
    
    var editor = $('.expression-preview-code');
    editor.val("function(doc) {\n  doc['"+ app.currentColumn+"'] = doc['"+ app.currentColumn+"'];\n  return doc;\n}");
    editor.focus().get(0).setSelectionRange(18, 18);
    editor.keydown(function(e) {
      // if you don't setTimeout it won't grab the latest character if you call e.target.value
      window.setTimeout( function() {
        var errors = $('.expression-preview-parsing-status');
        var editFunc = costco.evalFunction(e.target.value);
        if (!editFunc.errorMessage) {
          errors.text('No syntax error.');
          costco.previewTransform(app.cache, editFunc, app.currentColumn);
        } else {
          errors.text(editFunc.errorMessage);
        }
      }, 1, true);
    });
    editor.keydown();
  },
  transform: function() {
    $('.dialog-content .okButton').click(function(e) {
      util.notify("Not implemented yet, sorry! :D");
      util.hide('dialog');
    })
    
    var editor = $('.expression-preview-code');
    editor.val("function(val) {\n  if(_.isString(val)) this.update(\"pizza\")\n}");
    editor.focus().get(0).setSelectionRange(62,62);
    editor.keydown(function(e) {
      // if you don't setTimeout it won't grab the latest character if you call e.target.value
      window.setTimeout( function() {
        var errors = $('.expression-preview-parsing-status');
        var editFunc = costco.evalFunction(e.target.value);
        if (!editFunc.errorMessage) {
          errors.text('No syntax error.');
          var traverseFunc = function(doc) {
            util.traverse(doc).forEach(editFunc);
            return doc;
          }
          costco.previewTransform(app.cache, traverseFunc);
        } else {
          errors.text(editFunc.errorMessage);
        }
      }, 1, true);
    });
    editor.keydown();
  },
  urlImport: function() {
    $('.dialog-content .okButton').click(function(e) {
      app.apiURL = $.url($('#url-input').val().trim());
      util.notify("Fetching data...", {persist: true, loader: true});
      var query = $.param($.extend({}, app.apiURL.data.param.query, {"callback": "?"}))
      $.getJSON(app.apiURL.attr('base') + app.apiURL.attr('path') + "?" + decodeURIComponent(query)).then(
        function(docs) {
          app.apiDocs = docs;
          util.notify("Data fetched successfully!");
          recline.showDialog('jsonTree');
        },
        function (err) {
          util.hide('dialog');
          util.notify("Data fetch error: " + err.responseText);
        }
      );
    })
  },
  uploadImport: function() {
    $('.dialog-content .okButton').click(function(e) {
      util.hide('dialog');
      util.notify("Saving documents...", {persist: true, loader: true});
      costco.uploadCSV();
    })
  },
  jsonTree: function() {
    util.renderTree(app.apiDocs);
    $('.dialog-content .okButton').click(function(e) {
      util.hide('dialog');
      util.notify("Saving documents...", {persist: true, loader: true});
      costco.uploadDocs(util.lookupPath(util.selectedTreePath())).then(function(msg) {
        util.notify("Docs saved successfully!");
        recline.initializeTable(app.offset);
      });
    })
  },
  pasteImport: function() {
    $('.dialog-content .okButton').click(function(e) {
      util.notify("Uploading documents...", {persist: true, loader: true});
      try {
        var docs = JSON.parse($('.data-table-cell-copypaste-editor').val());        
      } catch(e) {
        util.notify("JSON parse error: " + e);
      }
      if (docs) {
        if(_.isArray(docs)) {
          costco.uploadDocs(docs).then(
            function(docs) {
              util.notify("Data uploaded successfully!");
              recline.initializeTable(app.offset);
              util.hide('dialog');
            },
            function (err) {
              util.hide('dialog');
              util.notify("Error uploading: " + err.responseText);
            }
          );        
        } else {
          util.notify("Error: JSON must be an array of objects");
        } 
      }
    })
  },
  sidebar: function() {
    var tabs = $('.ui-tabs-nav li');
    tabs.find('a').click(function(e) {
      var clicked = $(e.target)
        , tab = clicked.attr('data-tab')
        ;
      tabs.removeClass('ui-state-active');
      clicked.parents('li').addClass('ui-state-active');
      app.routes.tabs[tab]();
      e.preventDefault();
    })
    tabs.find('a').first().click();
  },
  appTemplates: function() {
    $('.appTemplates img').click(function(e) {
      var ddoc = $(e.target).attr('data-ddoc');
      util.addApp(ddoc, app.datasetInfo._id);
    })
  },
  appsTab: function() {
    $('.root').live('click', function(e) {
      var clicked = $(e.target)
        , ddoc = clicked.attr('data-ddoc')
        ;
      if(clicked.hasClass('selected')) return;
      $('.sidebar .selected').removeClass('selected');
      $(this).find('li').removeClass('hidden');
      clicked.addClass('selected');
      if (ddoc) {
        var domain = $.url(window.location).attr('authority');
        util.render("ddocIframe", "right-panel", {ddoc: ddoc, url: "http://" + app.datasetInfo.user + "-" + ddoc + "." + domain})
        util.getDDocFiles("/_design/" + ddoc).then(function(folder) {
          app.fileHtmlElementByPath = {}
          app.stateByPath = {}
          var ul = document.createElement("ul")
          for (var childEntry in folder.children) {
            util.addHTMLElementForFileEntry(folder.children[childEntry], ul)
          }
          clicked.find('#files').html('').html(ul);
        }); 
      }
    })
  }
}

$(function() {  

  $('a').live('click', function(event) {
    var route =  $(this).attr('href');
    util.catchModals(route);
  });

  app.router = Router({
    '/': {on: 'noID'},
    '/(\\w+)!': {on: function(modal) { util.catchModals("#/" + modal + "!") }},
    '/:dataset': {on: 'dataset'}
  }).use({ resource: app.routes.pages }).init('/');
  
})