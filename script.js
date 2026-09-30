// ================== FIREBASE ==================
var firebaseConfig = {
  apiKey: "AIzaSyDHFXOap1egB57a4Yh4y60tDbLMAzwyaz8",
  authDomain: "atta-chki.firebaseapp.com",
  projectId: "atta-chki",
  storageBucket: "atta-chki.firebasestorage.app",
  messagingSenderId: "906808155320",
  appId: "1:906808155320:web:5d6cc5e206b099ca27284d"
};

var db = null;
var firebaseReady = false;
var firebaseLoaded = false;

function initFirebase(callback) {
  if (firebaseLoaded) { if (callback) callback(); return; }
  firebaseLoaded = true;
  var script1 = document.createElement('script');
  script1.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js';
  script1.onload = function() {
    var script2 = document.createElement('script');
    script2.src = 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js';
    script2.onload = function() {
      try {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        firebaseReady = true;
        console.log('Firebase ready');
      } catch (e) { console.log('Firebase error:', e); }
      if (callback) callback();
    };
    document.head.appendChild(script2);
  };
  script1.onerror = function() { if (callback) callback(); };
  document.head.appendChild(script1);
}

// ================== DATA ==================
var shopkeepers = [];
var orders = [];
var products = ['Aata', 'Besan', 'Chawal ka Atta'];
var settings = { bizName: 'Atta Chakki', mode: 'mobile' };
var users = [];
var routes = [];
var isLoggedIn = false;
var currentUser = null;
var currentDeliverOrderId = null;
var currentDeliverProduct = null;
var currentCombinedProduct = null;
var currentCombinedOrderIds = [];

var selectedShopIdForOrder = null;
var selectedProductForOrder = null;
var selectedEditIndex = -1;
var currentOrderItems = [];
var selectedRouteShops = [];

// Pending shop modal ke liye
var currentPendingShopId = null;
var currentPendingProducts = [];

// Menu & Dashboard layout
var menuLayout = null;
var dashboardLayout = null;
var menuEditMode = false;
var dashboardEditMode = false;

// Default layouts
var DEFAULT_MENU = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-home', show: true },
  { key: 'neworder', label: 'Naya Order', icon: 'fa-plus-circle', show: true },
  { key: 'orders', label: 'Orders / Loading', icon: 'fa-truck', show: true },
  { key: 'routes', label: 'Delivery Routes', icon: 'fa-route', show: true },
  { key: 'shopkeepers', label: 'Shopkeepers', icon: 'fa-users', show: true },
  { key: 'delivery', label: 'Delivery', icon: 'fa-check-circle', show: true },
  { key: 'history', label: 'History', icon: 'fa-clock', show: true },
  { key: 'users', label: 'Users', icon: 'fa-user-shield', show: true },
  { key: 'settings', label: 'Settings', icon: 'fa-gear', show: true }
];

var DEFAULT_DASHBOARD = [
  { key: 'bigButtons', label: 'Big Buttons (Naya Order, Route, Orders)', show: true, size: 100 },
  { key: 'cards', label: '4 Cards (Shopkeepers, Orders, Pending, Delivered)', show: true, size: 100 },
  { key: 'pendingShops', label: "Today's Pending Shopkeeper Order", show: true, size: 100 },
  { key: 'load', label: 'Aaj Ka Load', show: true, size: 100 },
  { key: 'routes', label: 'Aaj Ke Delivery Routes', show: true, size: 100 }
];

// ================== FIREBASE SYNC ==================
function loadAllData(callback) {
  if (!firebaseReady) { if (callback) callback(); return; }
  var pending = 6;
  function done() { pending--; if (pending === 0 && callback) callback(); }

  db.collection('shopkeepers').get().then(function(snap) {
    shopkeepers = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; shopkeepers.push(d); });
    console.log('Shopkeepers:', shopkeepers.length);
    done();
  }).catch(function(e) { console.log(e); done(); });

  db.collection('orders').get().then(function(snap) {
    orders = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; orders.push(d); });
    console.log('Orders:', orders.length);
    done();
  }).catch(function(e) { console.log(e); done(); });

  db.collection('settings').doc('products').get().then(function(doc) {
    if (doc.exists) products = doc.data().list || products;
    done();
  }).catch(function(e) { done(); });

  db.collection('settings').doc('business').get().then(function(doc) {
    if (doc.exists) {
      var d = doc.data();
      if (d.bizName) settings.bizName = d.bizName;
    }
    done();
  }).catch(function(e) { done(); });

  db.collection('users').get().then(function(snap) {
    users = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; users.push(d); });
    done();
  }).catch(function(e) { done(); });

  db.collection('routes').get().then(function(snap) {
    routes = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; routes.push(d); });
    console.log('Routes:', routes.length);
    done();
  }).catch(function(e) { done(); });
}

function saveToFirebase(collection, id, data) {
  if (!firebaseReady) return;
  db.collection(collection).doc(String(id)).set(data).catch(function(e) { console.log(e); });
}
function deleteFromFirebase(collection, id) {
  if (!firebaseReady) return;
  db.collection(collection).doc(String(id)).delete().catch(function(e) { console.log(e); });
}
function saveSettingsFirebase() {
  if (!firebaseReady) return;
  saveToFirebase('settings', 'products', { list: products });
  saveToFirebase('settings', 'business', { bizName: settings.bizName });
}

// ================== LAYOUT SYSTEM ==================
function loadLayouts() {
  // Menu layout
  if (currentUser && currentUser.menuLayout && Array.isArray(currentUser.menuLayout) && currentUser.menuLayout.length > 0) {
    menuLayout = currentUser.menuLayout.slice();
    // Add any new defaults missing
    for (var i = 0; i < DEFAULT_MENU.length; i++) {
      var exists = false;
      for (var j = 0; j < menuLayout.length; j++) {
        if (menuLayout[j].key === DEFAULT_MENU[i].key) { exists = true; break; }
      }
      if (!exists) menuLayout.push(JSON.parse(JSON.stringify(DEFAULT_MENU[i])));
    }
  } else {
    menuLayout = JSON.parse(JSON.stringify(DEFAULT_MENU));
  }

  // Dashboard layout
  if (currentUser && currentUser.dashboardLayout && Array.isArray(currentUser.dashboardLayout) && currentUser.dashboardLayout.length > 0) {
    dashboardLayout = currentUser.dashboardLayout.slice();
    for (var i = 0; i < DEFAULT_DASHBOARD.length; i++) {
      var exists = false;
      for (var j = 0; j < dashboardLayout.length; j++) {
        if (dashboardLayout[j].key === DEFAULT_DASHBOARD[i].key) { exists = true; break; }
      }
      if (!exists) dashboardLayout.push(JSON.parse(JSON.stringify(DEFAULT_DASHBOARD[i])));
    }
  } else {
    dashboardLayout = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD));
  }
}

function saveMenuLayout() {
  if (!currentUser) return;
  currentUser.menuLayout = menuLayout.slice();
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) {
    db.collection('users').doc(String(currentUser.id)).update({ menuLayout: menuLayout }).catch(function(e) { console.log(e); });
  }
}

function saveDashboardLayout() {
  if (!currentUser) return;
  currentUser.dashboardLayout = dashboardLayout.slice();
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) {
    db.collection('users').doc(String(currentUser.id)).update({ dashboardLayout: dashboardLayout }).catch(function(e) { console.log(e); });
  }
}

// ================== MENU EDIT ==================
function toggleMenuEdit() {
  menuEditMode = !menuEditMode;
  var panel = document.getElementById('menuEditPanel');
  var nav = document.getElementById('sidebarNav');
  var btn = document.getElementById('editMenuBtn');
  if (menuEditMode) {
    panel.style.display = 'block';
    nav.style.display = 'none';
    btn.innerHTML = '<i class="fa fa-eye"></i> Preview Menu';
    renderMenuEditList();
  } else {
    panel.style.display = 'none';
    nav.style.display = 'flex';
    btn.innerHTML = '<i class="fa fa-pen"></i> Edit Menu';
    renderSidebarNav();
  }
}

function renderMenuEditList() {
  var list = document.getElementById('menuEditList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < menuLayout.length; i++) {
    var item = menuLayout[i];
    var canUp = i > 0;
    var canDown = i < menuLayout.length - 1;
    html += '<div class="menu-edit-item ' + (item.show ? '' : 'hidden-item') + '">' +
      '<input type="checkbox" ' + (item.show ? 'checked' : '') + ' onchange="toggleMenuShow(' + i + ', this.checked)" />' +
      '<span class="me-name"><i class="fa ' + item.icon + '"></i> ' + item.label + '</span>' +
      '<span class="me-arrows">' +
        '<button onclick="moveMenuItem(' + i + ', -1)" ' + (canUp ? '' : 'disabled') + '><i class="fa fa-arrow-up"></i></button>' +
        '<button onclick="moveMenuItem(' + i + ', 1)" ' + (canDown ? '' : 'disabled') + '><i class="fa fa-arrow-down"></i></button>' +
      '</span>' +
    '</div>';
  }
  list.innerHTML = html;
}

function toggleMenuShow(idx, checked) {
  if (idx < 0 || idx >= menuLayout.length) return;
  menuLayout[idx].show = checked;
  saveMenuLayout();
  renderMenuEditList();
  renderHiddenMenuList();
}

function moveMenuItem(idx, dir) {
  var newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= menuLayout.length) return;
  var temp = menuLayout[idx];
  menuLayout[idx] = menuLayout[newIdx];
  menuLayout[newIdx] = temp;
  saveMenuLayout();
  renderMenuEditList();
}

function resetMenuLayout() {
  if (!confirm('Menu ko default pe reset karein?')) return;
  menuLayout = JSON.parse(JSON.stringify(DEFAULT_MENU));
  saveMenuLayout();
  renderMenuEditList();
  renderHiddenMenuList();
  renderSidebarNav();
}

// ================== DASHBOARD EDIT ==================
function toggleDashboardEdit() {
  dashboardEditMode = !dashboardEditMode;
  var panel = document.getElementById('dashEditPanel');
  var editBtn = document.getElementById('editDashBtn');
  var doneBtn = document.getElementById('doneDashBtn');
  var resetBtn = document.getElementById('resetDashBtn');
  if (dashboardEditMode) {
    panel.style.display = 'block';
    editBtn.style.display = 'none';
    doneBtn.style.display = 'inline-block';
    resetBtn.style.display = 'inline-block';
    renderDashEditList();
    applyDashboardLayout();
  } else {
    panel.style.display = 'none';
    editBtn.style.display = 'inline-block';
    doneBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    applyDashboardLayout();
  }
}

function renderDashEditList() {
  var list = document.getElementById('dashEditList');
  if (!list) return;
  var html = '';
  for (var i = 0; i < dashboardLayout.length; i++) {
    var item = dashboardLayout[i];
    html += '<div class="dash-edit-row">' +
      '<input type="checkbox" ' + (item.show ? 'checked' : '') + ' onchange="toggleDashShow(' + i + ', this.checked)" />' +
      '<span class="de-name">' + item.label + '</span>' +
      '<span class="de-slider-wrap">' +
        '<input type="range" min="20" max="100" value="' + item.size + '" oninput="updateDashSize(' + i + ', this.value)" />' +
        '<span class="de-value" id="deVal' + i + '">' + item.size + '%</span>' +
      '</span>' +
    '</div>';
  }
  list.innerHTML = html;
}

function toggleDashShow(idx, checked) {
  if (idx < 0 || idx >= dashboardLayout.length) return;
  dashboardLayout[idx].show = checked;
  saveDashboardLayout();
  applyDashboardLayout();
  renderDashEditList();
}

function updateDashSize(idx, val) {
  if (idx < 0 || idx >= dashboardLayout.length) return;
  dashboardLayout[idx].size = parseInt(val) || 100;
  var lbl = document.getElementById('deVal' + idx);
  if (lbl) lbl.textContent = dashboardLayout[idx].size + '%';
  saveDashboardLayout();
  applyDashboardLayout();
}

function resetDashboardLayout() {
  if (!confirm('Dashboard ko default pe reset karein?')) return;
  dashboardLayout = JSON.parse(JSON.stringify(DEFAULT_DASHBOARD));
  saveDashboardLayout();
  applyDashboardLayout();
  renderDashEditList();
}

function applyDashboardLayout() {
  if (!dashboardLayout) return;
  var sectionIds = {
    bigButtons: 'sec-bigButtons',
    cards: 'sec-cards',
    pendingShops: 'sec-pendingShops',
    load: 'sec-load',
    routes: 'sec-routes'
  };
  for (var i = 0; i < dashboardLayout.length; i++) {
    var item = dashboardLayout[i];
    var el = document.getElementById(sectionIds[item.key]);
    if (!el) continue;
    if (item.show) {
      el.classList.remove('dash-hidden');
      el.style.display = '';
    } else {
      el.classList.add('dash-hidden');
      el.style.display = 'none';
    }
    // Size
    var size = parseInt(item.size) || 100;
    if (size >= 100) {
      el.style.width = '';
      el.style.maxWidth = '';
      el.style.marginLeft = '';
      el.style.marginRight = '';
    } else {
      el.style.width = size + '%';
      el.style.maxWidth = size + '%';
      el.style.marginLeft = 'auto';
      el.style.marginRight = 'auto';
    }
  }
}

// ================== HIDDEN MENU LIST (Settings) ==================
function renderHiddenMenuList() {
  var box = document.getElementById('hiddenMenuBox');
  var list = document.getElementById('hiddenMenuList');
  if (!box || !list) return;
  if (!menuLayout) { box.style.display = 'none'; return; }
  var hidden = [];
  for (var i = 0; i < menuLayout.length; i++) {
    if (!menuLayout[i].show) hidden.push(menuLayout[i]);
  }
  if (hidden.length === 0) {
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  var html = '';
  for (var i = 0; i < hidden.length; i++) {
    var h = hidden[i];
    html += '<a class="hidden-menu-link" onclick="showPage(\'' + h.key + '\', null)">' +
      '<i class="fa ' + h.icon + '"></i> ' + h.label +
      '<i class="fa fa-arrow-right" style="margin-left:auto;"></i>' +
    '</a>';
  }
  list.innerHTML = html;
}

// ================== WHATSAPP HELPERS ==================
function formatWaNumber(mobile) {
  if (!mobile) return '';
  var digits = String(mobile).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.indexOf('0') === 0) return '92' + digits.substring(1);
  if (digits.indexOf('92') === 0) return digits;
  if (digits.length === 10 && digits.indexOf('3') === 0) return '92' + digits;
  return digits;
}

function formatOrderItemsText(items) {
  var lines = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var qty = qtyText(it.maund, it.kg);
    lines.push('• ' + it.product + ' — ' + qty);
  }
  return lines.join('\n');
}

function sendOrderWhatsApp(order, shop) {
  if (!shop || !shop.mobile) return false;
  var number = formatWaNumber(shop.mobile);
  if (!number) return false;
  var bizName = settings.bizName || 'Atta Chakki';
  var itemsText = formatOrderItemsText(order.items);
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    'Aap ka order book ho chuka hai:\n\n' +
    itemsText + '\n\n' +
    'Inshallah jald hi deliver ho jayega.\n' +
    'Shukriya!\n' +
    '- ' + bizName;
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
  return true;
}

function sendDeliveredWhatsApp(order, shop) {
  if (!shop || !shop.mobile) return false;
  var number = formatWaNumber(shop.mobile);
  if (!number) return false;
  var bizName = settings.bizName || 'Atta Chakki';
  var lines = [];
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    var dm = parseInt(it.deliveredMaund) || 0;
    var dk = parseInt(it.deliveredKg) || 0;
    if (dm > 0 || dk > 0) {
      lines.push('• ' + it.product + ' — ' + qtyText(dm, dk));
    } else {
      var m = parseInt(it.maund) || 0;
      var k = parseInt(it.kg) || 0;
      lines.push('• ' + it.product + ' — ' + qtyText(m, k));
    }
  }
  var itemsText = lines.join('\n');
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    'Aap ka order deliver ho chuka hai:\n\n' +
    itemsText + '\n\n' +
    'Shukriya!\n' +
    '- ' + bizName;
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
  return true;
}

function sendMultiDeliveredWhatsApp(items, shop) {
  if (!shop || !shop.mobile) return false;
  var number = formatWaNumber(shop.mobile);
  if (!number) return false;
  var bizName = settings.bizName || 'Atta Chakki';
  var lines = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var qtyParts = [];
    if (it.maund > 0) qtyParts.push(it.maund + ' maund');
    for (var k = 0; k < it.kgList.length; k++) qtyParts.push(it.kgList[k] + ' kg');
    if (qtyParts.length === 0 && it.kg > 0) qtyParts.push(it.kg + ' kg');
    var qtyStr = qtyParts.join(', ') || '0 kg';
    lines.push('• ' + it.product + ' — ' + qtyStr);
  }
  var itemsText = lines.join('\n');
  var msg = 'Assalam-o-Alaikum ' + shop.name + '!\n\n' +
    'Aap ka order deliver ho chuka hai:\n\n' +
    itemsText + '\n\n' +
    'Shukriya!\n' +
    '- ' + bizName;
  var url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
  window.open(url, '_blank');
  return true;
}

function getShopById(shopId) {
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == shopId) return shopkeepers[i];
  }
  return null;
}

// ================== ROUTE AUTO-CLEANUP ==================
function cleanupRouteAfterDelivery() {
  if (!firebaseReady) return;
  var routesChanged = false;
  for (var r = routes.length - 1; r >= 0; r--) {
    var route = routes[r];
    var ids = (route.shopIds || []).slice();
    var newIds = [];
    for (var i = 0; i < ids.length; i++) {
      var sid = ids[i];
      var hasPending = false;
      for (var j = 0; j < orders.length; j++) {
        var o = orders[j];
        if (o.shopId != sid) continue;
        if (o.status !== 'Pending' && o.status !== 'Partial') continue;
        hasPending = true;
        break;
      }
      if (hasPending) newIds.push(sid);
    }
    if (newIds.length !== ids.length) {
      if (newIds.length === 0) {
        deleteFromFirebase('routes', route.id);
        routes.splice(r, 1);
        routesChanged = true;
      } else {
        route.shopIds = newIds;
        route.updatedAt = new Date().toISOString();
        saveToFirebase('routes', route.id, route);
        routesChanged = true;
      }
    }
  }
  if (routesChanged) {
    renderRoutes();
    renderDashboardRoutes();
  }
}

// ================== AUTO DATE SHIFT ==================
function autoShiftPendingOrders() {
  if (!firebaseReady) return;
  var today = todayStr();
  var shifted = 0;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if ((o.status === 'Pending' || o.status === 'Partial') && o.date !== today && o.date < today) {
      o.date = today;
      o.autoShifted = true;
      saveToFirebase('orders', o.id, o);
      shifted++;
    }
  }
  if (shifted > 0) console.log(shifted + ' pending orders shifted');
}

// ================== PIN SYSTEM ==================
function showPinScreen() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('appWrapper').style.display = 'none';
  document.getElementById('pinScreen').style.display = 'flex';
  document.getElementById('pinUserName').textContent = 'Hi, ' + (currentUser.display || currentUser.user);
  document.getElementById('pinInput').value = '';
  document.getElementById('pinError').textContent = '';
  setTimeout(function() { document.getElementById('pinInput').focus(); }, 200);
}
function verifyPin() {
  var entered = document.getElementById('pinInput').value.trim();
  var err = document.getElementById('pinError');
  err.textContent = '';
  if (!entered || entered.length !== 4) { err.textContent = 'PIN 4-digit ka hona chahiye'; return; }
  if (!currentUser || !currentUser.pin) { err.textContent = 'PIN set nahi hai. Password se login karein.'; return; }
  if (entered !== String(currentUser.pin)) {
    err.textContent = 'Ghalat PIN';
    document.getElementById('pinInput').value = '';
    return;
  }
  document.getElementById('pinScreen').style.display = 'none';
  showApp();
}
function pinForgot() {
  if (!confirm('PIN bhool gaye? Aapko password se login karna hoga.')) return;
  if (currentUser && currentUser.pin) {
    currentUser.pin = '';
    if (firebaseReady && currentUser.id) {
      db.collection('users').doc(String(currentUser.id)).update({ pin: '' }).catch(function(e) { console.log(e); });
    }
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === currentUser.id) { users[i].pin = ''; break; }
    }
  }
  localStorage.setItem('isLoggedIn', 'false');
  localStorage.removeItem('currentUser');
  currentUser = null;
  isLoggedIn = false;
  document.getElementById('pinScreen').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
}
function promptPinSetup() {
  if (currentUser && currentUser.pin) return;
  document.getElementById('pinSetupBanner').style.display = 'block';
}
function hidePinBanner() {
  document.getElementById('pinSetupBanner').style.display = 'none';
}
function openPinSetup() {
  document.getElementById('pinSetupTitle').textContent = 'PIN Set Karein';
  document.getElementById('newPin1').value = '';
  document.getElementById('newPin2').value = '';
  document.getElementById('pinSetupError').textContent = '';
  document.getElementById('pinSetupModal').classList.add('active');
  setTimeout(function() { document.getElementById('newPin1').focus(); }, 200);
}
function closePinSetup() {
  document.getElementById('pinSetupModal').classList.remove('active');
}
function savePin() {
  var p1 = document.getElementById('newPin1').value.trim();
  var p2 = document.getElementById('newPin2').value.trim();
  var err = document.getElementById('pinSetupError');
  err.textContent = '';
  if (!p1 || !p2) { err.textContent = 'Dono PIN daalein'; return; }
  if (p1.length !== 4 || !/^\d{4}$/.test(p1)) { err.textContent = 'PIN 4-digit numbers ka hona chahiye'; return; }
  if (p1 !== p2) { err.textContent = 'PIN match nahi kar rahe'; return; }
  if (p1 === '0000') { err.textContent = '0000 PIN nahi rakh sakte'; return; }
  if (!currentUser) { err.textContent = 'User nahi mila'; return; }
  currentUser.pin = p1;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) {
    db.collection('users').doc(String(currentUser.id)).update({ pin: p1 }).catch(function(e) { console.log(e); });
  }
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === currentUser.id) { users[i].pin = p1; break; }
  }
  closePinSetup();
  hidePinBanner();
  renderPinSettings();
  alert('PIN save ho gaya! Agli baar website kholte hi PIN maanga jayega.');
}
function removePin() {
  if (!confirm('PIN remove karne hain? Agli baar seedha dashboard khulega.')) return;
  if (!currentUser) return;
  currentUser.pin = '';
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady && currentUser.id) {
    db.collection('users').doc(String(currentUser.id)).update({ pin: '' }).catch(function(e) { console.log(e); });
  }
  for (var i = 0; i < users.length; i++) {
    if (users[i].id === currentUser.id) { users[i].pin = ''; break; }
  }
  renderPinSettings();
  alert('PIN remove ho gaya!');
}
function renderPinSettings() {
  var status = document.getElementById('pinStatusText');
  var setBtn = document.getElementById('setPinBtn');
  var remBtn = document.getElementById('removePinBtn');
  if (!status) return;
  if (currentUser && currentUser.pin) {
    status.textContent = '✅ PIN set hai. Website dubara kholne pe PIN maanga jayega.';
    if (setBtn) setBtn.textContent = 'PIN Change Karein';
    if (remBtn) remBtn.style.display = 'inline-block';
  } else {
    status.textContent = 'PIN abhi set nahi hai.';
    if (setBtn) setBtn.innerHTML = '<i class="fa fa-plus"></i> Set PIN';
    if (remBtn) remBtn.style.display = 'none';
  }
}

// ================== PERMISSIONS ==================
function isAdmin() { return currentUser && currentUser.isAdmin === true; }
function can(permission) {
  if (!currentUser) return false;
  if (currentUser.isAdmin) return true;
  if (!currentUser.perms) return false;
  return currentUser.perms[permission] === true;
}

// ================== SIGNUP ==================
function doSignup() {
  var user = document.getElementById('signupUser').value.trim();
  var pass = document.getElementById('signupPass').value;
  var pass2 = document.getElementById('signupPass2').value;
  var err = document.getElementById('loginError');
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Username aur password daalein'; return; }
  if (pass.length < 4) { err.textContent = 'Password kam az kam 4 characters'; return; }
  if (pass !== pass2) { err.textContent = 'Password match nahi'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua.'; return; }
  err.textContent = 'Account bana rahe hain...';
  db.collection('users').where('user', '==', user).get().then(function(snap) {
    if (!snap.empty) { err.textContent = 'Ye username pehle se mojood hai'; return; }
    var adminUser = {
      user: user, pass: pass, display: user, isAdmin: true, pin: '',
      perms: { newOrder: true, deliver: true, shopkeepers: true, history: true, settings: true, routes: true },
      menuLayout: JSON.parse(JSON.stringify(DEFAULT_MENU)),
      dashboardLayout: JSON.parse(JSON.stringify(DEFAULT_DASHBOARD)),
      createdAt: new Date().toISOString()
    };
    db.collection('users').add(adminUser).then(function(ref) {
      err.textContent = '';
      alert('Admin account ban gaya! Ab login karein.');
      hideSignup();
      document.getElementById('loginUser').value = user;
      document.getElementById('loginPass').value = '';
    }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
  }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
}

// ================== LOGIN ==================
function doLogin() {
  var user = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  var err = document.getElementById('loginError');
  err.textContent = '';
  if (!user || !pass) { err.textContent = 'Username aur password daalein'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua.'; return; }
  err.textContent = 'Check kar rahe hain...';
  db.collection('users').where('user', '==', user).get().then(function(snap) {
    if (snap.empty) { err.textContent = 'Ghalat username ya password'; return; }
    var found = null;
    snap.forEach(function(doc) {
      var d = doc.data();
      d.id = doc.id;
      if (d.pass === pass) found = d;
    });
    if (!found) { err.textContent = 'Ghalat username ya password'; return; }
    err.textContent = '';
    currentUser = found;
    isLoggedIn = true;
    localStorage.setItem('isLoggedIn', 'true');
    localStorage.setItem('currentUser', JSON.stringify(found));
    showApp();
    if (!currentUser.pin) {
      setTimeout(function() { promptPinSetup(); }, 500);
    }
  }).catch(function(e) { err.textContent = 'Error: ' + e.message; });
}

function showSignup() {
  document.getElementById('signupSection').style.display = 'block';
  document.getElementById('signupLinkBox').style.display = 'none';
  document.getElementById('loginError').textContent = '';
}
function hideSignup() {
  document.getElementById('signupSection').style.display = 'none';
  document.getElementById('signupLinkBox').style.display = 'block';
  document.getElementById('signupUser').value = '';
  document.getElementById('signupPass').value = '';
  document.getElementById('signupPass2').value = '';
}
function doLogout() {
  if (!confirm('Logout karna hai?')) return;
  isLoggedIn = false; currentUser = null;
  localStorage.setItem('isLoggedIn', 'false');
  localStorage.removeItem('currentUser');
  document.getElementById('appWrapper').style.display = 'none';
  document.getElementById('pinSetupBanner').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  hideSignup();
}

function changePassword() {
  var oldP = document.getElementById('oldPass').value;
  var newP = document.getElementById('newPass').value;
  if (!oldP || !newP) { alert('Dono password daalein'); return; }
  if (newP.length < 4) { alert('Password kam az kam 4 characters'); return; }
  if (currentUser.pass !== oldP) { alert('Purana password ghalat hai'); return; }
  currentUser.pass = newP;
  localStorage.setItem('currentUser', JSON.stringify(currentUser));
  if (firebaseReady) db.collection('users').doc(String(currentUser.id)).update({ pass: newP });
  document.getElementById('oldPass').value = '';
  document.getElementById('newPass').value = '';
  alert('Password change ho gaya!');
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('pinScreen').style.display = 'none';
  document.getElementById('appWrapper').style.display = 'block';
  loadLayouts();
  renderSidebarNav();
  applySettings();
  renderDashboard();
  renderShopkeepers();
  prepareOrderForm();
  renderHistory();
  renderSettings();
  renderRoutes();
  renderRouteShopPicker();
  renderPinSettings();
  applyDashboardLayout();
  renderHiddenMenuList();
  if (isAdmin()) renderUsers();
}

// ================== MANUAL SYNC ==================
function manualSync() {
  if (!firebaseReady) { alert('Firebase load nahi hua. Page refresh karein.'); return; }
  var btn = document.getElementById('syncBtn');
  var icon = document.getElementById('syncIcon');
  if (icon) icon.className = 'fa fa-sync-alt fa-spin';
  if (btn) btn.disabled = true;
  loadAllData(function() {
    autoShiftPendingOrders();
    if (currentUser) {
      for (var i = 0; i < users.length; i++) {
        if (users[i].id === currentUser.id) {
          currentUser = users[i];
          localStorage.setItem('currentUser', JSON.stringify(currentUser));
          break;
        }
      }
    }
    loadLayouts();
    renderSidebarNav();
    renderDashboard();
    renderShopkeepers();
    renderRoutes();
    renderHistory();
    renderSettings();
    renderRouteShopPicker();
    renderPinSettings();
    applyDashboardLayout();
    renderHiddenMenuList();
    if (isAdmin()) renderUsers();
    if (can('newOrder')) prepareOrderForm();
    var ordPage = document.getElementById('orders');
    if (ordPage && ordPage.classList.contains('active')) renderOrdersPage();
    var delPage = document.getElementById('delivery');
    if (delPage && delPage.classList.contains('active')) renderDelivery();
    if (icon) icon.className = 'fa fa-sync-alt';
    if (btn) btn.disabled = false;
    var titleEl = document.getElementById('topbarTitle');
    var oldTitle = titleEl ? titleEl.textContent : '';
    if (titleEl) {
      titleEl.textContent = '✓ Sync ho gaya!';
      setTimeout(function() { titleEl.textContent = oldTitle; }, 1500);
    }
  });
}

// ================== SIDEBAR ==================
function renderSidebarNav() {
  var nav = document.getElementById('sidebarNav');
  if (!nav || !menuLayout) return;

  // Current active page
  var activePage = 'dashboard';
  var pages = document.querySelectorAll('.page.active');
  if (pages.length > 0) activePage = pages[0].id;

  var html = '';
  for (var i = 0; i < menuLayout.length; i++) {
    var item = menuLayout[i];
    if (!item.show) continue;

    // Permission check
    if (item.key === 'neworder' && !can('newOrder')) continue;
    if (item.key === 'shopkeepers' && !can('shopkeepers')) continue;
    if (item.key === 'history' && !can('history')) continue;
    if (item.key === 'settings' && !can('settings')) continue;
    if (item.key === 'users' && !isAdmin()) continue;
    if (item.key === 'routes' && !can('routes')) continue;

    var activeClass = (activePage === item.key) ? ' active' : '';
    html += '<button class="nav-btn' + activeClass + '" onclick="showPage(\'' + item.key + '\', this)">' +
      '<i class="fa ' + item.icon + '"></i> <span>' + item.label + '</span>' +
    '</button>';
  }
  html += '<button class="nav-btn" onclick="doLogout()"><i class="fa fa-sign-out-alt"></i> <span>Logout</span></button>';
  nav.innerHTML = html;

  if (currentUser) {
    document.getElementById('userNameLabel').textContent = currentUser.display || currentUser.user;
    var roleEl = document.getElementById('userRoleLabel');
    roleEl.textContent = currentUser.isAdmin ? 'Admin' : 'Staff';
    roleEl.className = 'user-role' + (currentUser.isAdmin ? ' admin' : '');
  }
}

// ================== HELPERS ==================
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatDate(s) {
  if (!s) return '';
  var d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateLong(s) {
  var d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
function toggleSidebar() {
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
}
function qtyText(maund, kg) {
  var m = parseInt(maund) || 0;
  var k = parseInt(kg) || 0;
  if (m === 0 && k === 0) return '0 kg';
  var parts = [];
  if (m > 0) parts.push(m + ' maund');
  if (k > 0) parts.push(k + ' kg');
  return parts.join(' ');
}
function totalKgText(totalKg) {
  var total = parseInt(totalKg) || 0;
  var m = Math.floor(total / 40);
  var k = total % 40;
  return qtyText(m, k);
}
function productQtySummary(items) {
  var totalMaund = 0, kgList = [];
  for (var i = 0; i < items.length; i++) {
    var m = parseInt(items[i].maund) || 0;
    var k = parseInt(items[i].kg) || 0;
    totalMaund += m;
    if (k > 0) kgList.push(k);
  }
  var parts = [];
  if (totalMaund > 0) parts.push(totalMaund + ' maund');
  for (var i = 0; i < kgList.length; i++) parts.push(kgList[i] + ' kg');
  if (parts.length === 0) return '0 kg';
  return parts.join(', ');
}
function getPendingItemsForProduct(order, product) {
  var pending = [];
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    if (it.product !== product) continue;
    var m = parseInt(it.maund) || 0;
    var k = parseInt(it.kg) || 0;
    var dm = parseInt(it.deliveredMaund) || 0;
    var dk = parseInt(it.deliveredKg) || 0;
    var remM = m - dm, remK = k - dk;
    if (remM > 0 || remK > 0) pending.push({ item: it, index: i, maund: remM, kg: remK });
  }
  return pending;
}
function checkOrderDelivered(order) {
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    var m = parseInt(it.maund) || 0;
    var k = parseInt(it.kg) || 0;
    var dm = parseInt(it.deliveredMaund) || 0;
    var dk = parseInt(it.deliveredKg) || 0;
    if (dm < m || dk < k) return false;
  }
  return true;
}

// ================== NAVIGATION ==================
function showPage(pageId, btn) {
  if (pageId === 'neworder' && !can('newOrder')) { alert('Permission nahi hai'); return; }
  if (pageId === 'shopkeepers' && !can('shopkeepers')) { alert('Permission nahi hai'); return; }
  if (pageId === 'history' && !can('history')) { alert('Permission nahi hai'); return; }
  if (pageId === 'settings' && !can('settings')) { alert('Permission nahi hai'); return; }
  if (pageId === 'users' && !isAdmin()) { alert('Sirf Admin'); return; }
  if (pageId === 'routes' && !can('routes')) { alert('Permission nahi hai'); return; }

  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var target = document.getElementById(pageId);
  if (target) target.classList.add('active');

  // Sidebar nav highlight
  var navBtns = document.querySelectorAll('.nav-btn');
  for (var j = 0; j < navBtns.length; j++) navBtns[j].classList.remove('active');
  if (btn) btn.classList.add('active');

  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');

  // Close menu edit if open
  if (menuEditMode) {
    menuEditMode = false;
    document.getElementById('menuEditPanel').style.display = 'none';
    document.getElementById('sidebarNav').style.display = 'flex';
    document.getElementById('editMenuBtn').innerHTML = '<i class="fa fa-pen"></i> Edit Menu';
  }

  if (pageId === 'dashboard') {
    renderDashboard();
    applyDashboardLayout();
  }
  if (pageId === 'shopkeepers') renderShopkeepers();
  if (pageId === 'neworder') prepareOrderForm();
  if (pageId === 'orders') {
    var dEl = document.getElementById('ordersDate');
    if (dEl && !dEl.value) dEl.value = todayStr();
    renderOrdersPage();
  }
  if (pageId === 'delivery') renderDelivery();
  if (pageId === 'history') renderHistory();
  if (pageId === 'settings') { renderSettings(); renderPinSettings(); renderHiddenMenuList(); }
  if (pageId === 'users') renderUsers();
  if (pageId === 'routes') { renderRoutes(); renderRouteShopPicker(); }
  window.scrollTo(0, 0);
}

// ================== SETTINGS ==================
function applySettings() {
  var t1 = document.getElementById('topbarTitle');
  var t2 = document.getElementById('sidebarTitle');
  if (t1) t1.textContent = settings.bizName;
  if (t2) t2.textContent = settings.bizName;
  document.title = settings.bizName;
  var body = document.body;
  body.classList.remove('pc-mode');
  body.classList.add('mobile-mode');
}
function saveBizName() {
  var el = document.getElementById('setBizName');
  var name = el.value.trim();
  if (!name) { alert('Naam likhein'); return; }
  settings.bizName = name;
  saveSettingsFirebase();
  applySettings();
  alert('Naam save ho gaya!');
}
function renderSettings() {
  var nameEl = document.getElementById('setBizName');
  if (nameEl) nameEl.value = settings.bizName;
  renderProductsList();
}
function renderProductsList() {
  var list = document.getElementById('productsList');
  if (!list) return;
  if (products.length === 0) { list.innerHTML = '<p class="hint">Koi product nahi.</p>'; return; }
  var html = '';
  for (var i = 0; i < products.length; i++) {
    html += '<div class="product-chip">' + products[i] + '<button onclick="deleteProduct(' + i + ')">&times;</button></div>';
  }
  list.innerHTML = html;
}
function addProduct() {
  var input = document.getElementById('newProductName');
  var name = input.value.trim();
  if (!name) { alert('Naam likhein'); return; }
  if (products.indexOf(name) !== -1) { alert('Already mojood hai'); return; }
  products.push(name);
  saveSettingsFirebase();
  input.value = '';
  renderProductsList();
  renderProductPickerGrid();
}
function deleteProduct(i) {
  if (!confirm('Delete: ' + products[i] + '?')) return;
  products.splice(i, 1);
  saveSettingsFirebase();
  renderProductsList();
  renderProductPickerGrid();
}

// ================== USERS ==================
function saveUser() {
  if (!isAdmin()) { alert('Sirf Admin'); return; }
  var id = document.getElementById('userId').value;
  var user = document.getElementById('newUserName').value.trim();
  var pass = document.getElementById('newUserPass').value;
  var display = document.getElementById('newUserDisplay').value.trim();
  if (!user || !pass) { alert('Username aur password zaroori!'); return; }
  if (pass.length < 4) { alert('Password kam az kam 4 characters'); return; }
  for (var i = 0; i < users.length; i++) {
    if (users[i].user === user && users[i].id != id) { alert('Ye username pehle se mojood hai'); return; }
  }
  var perms = {
    newOrder: document.getElementById('permNewOrder').checked,
    deliver: document.getElementById('permDeliver').checked,
    shopkeepers: document.getElementById('permShopkeepers').checked,
    history: document.getElementById('permHistory').checked,
    settings: document.getElementById('permSettings').checked,
    routes: document.getElementById('permRoutes').checked
  };
  if (id) {
    for (var i = 0; i < users.length; i++) {
      if (users[i].id == id) {
        users[i].user = user; users[i].pass = pass;
        users[i].display = display || user; users[i].perms = perms;
        saveToFirebase('users', users[i].id, users[i]);
      }
    }
    alert('User save!'); resetUserForm(); renderUsers(); return;
  }
  var newUser = {
    user: user, pass: pass, display: display || user, isAdmin: false, perms: perms, pin: '',
    menuLayout: JSON.parse(JSON.stringify(DEFAULT_MENU)),
    dashboardLayout: JSON.parse(JSON.stringify(DEFAULT_DASHBOARD)),
    createdAt: new Date().toISOString()
  };
  if (firebaseReady) {
    db.collection('users').add(newUser).then(function(ref) {
      newUser.id = ref.id;
      users.push(newUser);
      alert('User save ho gaya!');
      resetUserForm(); renderUsers();
    }).catch(function(e) { alert('Error: ' + e.message); });
  }
}
function resetUserForm() {
  document.getElementById('userId').value = '';
  document.getElementById('newUserName').value = '';
  document.getElementById('newUserPass').value = '';
  document.getElementById('newUserDisplay').value = '';
  document.getElementById('permNewOrder').checked = true;
  document.getElementById('permDeliver').checked = true;
  document.getElementById('permShopkeepers').checked = false;
  document.getElementById('permHistory').checked = true;
  document.getElementById('permSettings').checked = false;
  document.getElementById('permRoutes').checked = true;
  document.getElementById('userFormTitle').textContent = 'Naya User Banayein';
}
function editUser(id) {
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == id) {
      var u = users[i];
      if (u.isAdmin) { alert('Admin ko edit nahi kar sakte'); return; }
      document.getElementById('userId').value = u.id;
      document.getElementById('newUserName').value = u.user;
      document.getElementById('newUserPass').value = u.pass;
      document.getElementById('newUserDisplay').value = u.display || '';
      document.getElementById('permNewOrder').checked = u.perms.newOrder === true;
      document.getElementById('permDeliver').checked = u.perms.deliver === true;
      document.getElementById('permShopkeepers').checked = u.perms.shopkeepers === true;
      document.getElementById('permHistory').checked = u.perms.history === true;
      document.getElementById('permSettings').checked = u.perms.settings === true;
      document.getElementById('permRoutes').checked = u.perms.routes === true;
      document.getElementById('userFormTitle').textContent = 'User Edit Karein';
      window.scrollTo(0, 0);
    }
  }
}
function deleteUser(id) {
  if (!isAdmin()) return;
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == id && users[i].isAdmin) { alert('Admin delete nahi'); return; }
  }
  if (!confirm('Pakka delete?')) return;
  var newList = [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].id != id) newList.push(users[i]);
    else deleteFromFirebase('users', users[i].id);
  }
  users = newList;
  renderUsers();
}
function renderUsers() {
  if (!isAdmin()) return;
  var list = document.getElementById('usersList');
  if (!list) return;
  if (users.length === 0) { list.innerHTML = '<div class="empty"><i class="fa fa-users"></i>Koi user nahi.</div>'; return; }
  var html = '';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var badge = u.isAdmin ? '<span class="badge admin-badge">ADMIN</span>' : '<span class="badge staff-badge">STAFF</span>';
    var pinBadge = u.pin ? ' <span class="badge delivered" style="background:#e0e7ff;color:#3730a3;">🔒 PIN</span>' : '';
    var chips = '';
    var permsList = [
      { k: 'newOrder', label: 'Naya Order' }, { k: 'deliver', label: 'Deliver' },
      { k: 'shopkeepers', label: 'Shopkeepers' }, { k: 'history', label: 'History' },
      { k: 'settings', label: 'Settings' }, { k: 'routes', label: 'Routes' }
    ];
    for (var j = 0; j < permsList.length; j++) {
      var on = u.isAdmin || (u.perms && u.perms[permsList[j].k] === true);
      chips += '<span class="perm-chip ' + (on ? '' : 'off') + '">' + permsList[j].label + '</span>';
    }
    var actions = '';
    if (!u.isAdmin) {
      actions = '<button class="btn small" onclick="editUser(\'' + u.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
                '<button class="btn small danger" onclick="deleteUser(\'' + u.id + '\')"><i class="fa fa-trash"></i></button>';
    }
    html += '<div class="item user-item"><div class="item-info">' +
      '<h4><i class="fa fa-user-circle"></i> ' + (u.display || u.user) + '</h4>' +
      '<p><b>@' + u.user + '</b></p>' + badge + pinBadge +
      '<div class="perm-chips">' + chips + '</div></div>' +
      '<div class="item-actions">' + actions + '</div></div>';
  }
  list.innerHTML = html;
}

// ================== DASHBOARD ==================
function renderDashboard() {
  var today = todayStr();
  var dateLabel = document.getElementById('todayDateLabel');
  if (dateLabel) dateLabel.textContent = formatDateLong(today);
  document.getElementById('totalShopkeepers').textContent = shopkeepers.length;
  document.getElementById('todayOrders').textContent = orders.filter(function(o) { return o.date === today; }).length;
  document.getElementById('pendingOrders').textContent = orders.filter(function(o) { return o.status === 'Pending' || o.status === 'Partial'; }).length;
  document.getElementById('deliveredOrders').textContent = orders.filter(function(o) { return o.status === 'Delivered'; }).length;

  var todayPending = orders.filter(function(o) { return o.date === today && (o.status === 'Pending' || o.status === 'Partial'); });
  var totalKg = 0;
  for (var i = 0; i < todayPending.length; i++) {
    var o = todayPending[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      totalKg += (remM * 40) + remK;
    }
  }
  document.getElementById('todayLoadBadge').textContent = totalKgText(totalKg);
  var list = document.getElementById('todayLoadList');
  if (todayPending.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Aaj koi pending order nahi.</div>';
  } else {
    var byProduct = {};
    for (var i = 0; i < todayPending.length; i++) {
      var o = todayPending[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        var p = it.product;
        if (!byProduct[p]) byProduct[p] = [];
        byProduct[p].push({ maund: remM, kg: remK });
      }
    }
    var rows = '';
    var keys = Object.keys(byProduct);
    for (var k = 0; k < keys.length; k++) {
      rows += '<div class="shop-order-line"><span class="product-name">📦 ' + keys[k] + '</span><span class="qty">' + productQtySummary(byProduct[keys[k]]) + '</span></div>';
    }
    list.innerHTML = rows || '<div class="empty">Sab deliver ho gaya!</div>';
  }
  renderPendingShopkeeperList();
  renderDashboardRoutes();
}

function renderPendingShopkeeperList() {
  var today = todayStr();
  var list = document.getElementById('pendingShopList');
  var badge = document.getElementById('pendingShopBadge');
  if (!list) return;
  var grouped = {};
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.date !== today) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    if (!grouped[o.shopId]) grouped[o.shopId] = 0;
    grouped[o.shopId]++;
  }
  var shopIds = Object.keys(grouped);
  if (badge) badge.textContent = shopIds.length;
  if (shopIds.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Aaj koi pending shopkeeper order nahi.</div>';
    return;
  }
  var html = '';
  for (var k = 0; k < shopIds.length; k++) {
    var sid = shopIds[k];
    var shopName = 'Unknown';
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == sid) shopName = shopkeepers[i].name;
    }
    var count = grouped[sid];
    html += '<div class="pending-shop-name" onclick="openPendingShopModal(\'' + sid + '\')">' +
      '<span class="name-text"><i class="fa fa-store shop-icon"></i> ' + shopName + '</span>' +
      '<span><span class="order-count">' + count + '</span><i class="fa fa-chevron-right arrow-icon"></i></span></div>';
  }
  list.innerHTML = html;
}

// ============ PENDING SHOP MODAL — CHECKBOX + MULTI DELIVER ============
function openPendingShopModal(shopId) {
  var today = todayStr();
  var shopName = 'Unknown', shopMobile = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopMobile = shopkeepers[i].mobile; }
  }
  document.getElementById('pendingShopTitle').textContent = shopName + ' - Aaj Ke Orders';
  document.getElementById('pendingShopModal').setAttribute('data-shop-id', shopId);
  currentPendingShopId = shopId;

  var sOrders = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == shopId && o.date === today && (o.status === 'Pending' || o.status === 'Partial')) sOrders.push(o);
  }

  var body = document.getElementById('pendingShopBody');
  if (sOrders.length === 0) {
    body.innerHTML = '<div class="empty">Koi pending order nahi.</div>';
    document.getElementById('pendingShopModal').classList.add('active');
    currentPendingProducts = [];
    return;
  }

  var productMap = {};
  var productOrder = [];

  for (var i = 0; i < sOrders.length; i++) {
    var o = sOrders[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      if (remM <= 0 && remK <= 0) continue;
      var pName = it.product;
      if (!productMap[pName]) {
        productMap[pName] = { maund: 0, kg: 0, kgList: [], orderIds: [] };
        productOrder.push(pName);
      }
      productMap[pName].maund += remM;
      productMap[pName].kg += remK;
      if (remK > 0) productMap[pName].kgList.push(remK);
      if (productMap[pName].orderIds.indexOf(o.id) === -1) {
        productMap[pName].orderIds.push(o.id);
      }
    }
  }

  var grandTotalKg = 0;
  currentPendingProducts = [];
  for (var p = 0; p < productOrder.length; p++) {
    var pm = productMap[productOrder[p]];
    grandTotalKg += (pm.maund * 40) + pm.kg;
    currentPendingProducts.push({
      product: productOrder[p],
      maund: pm.maund,
      kg: pm.kg,
      kgList: pm.kgList.slice(),
      orderIds: pm.orderIds.slice()
    });
  }

  var linesHtml = '';
  for (var p = 0; p < currentPendingProducts.length; p++) {
    var pd = currentPendingProducts[p];
    var qtyParts = [];
    if (pd.maund > 0) qtyParts.push(pd.maund + ' maund');
    for (var q = 0; q < pd.kgList.length; q++) qtyParts.push(pd.kgList[q] + ' kg');
    var qtyStr = qtyParts.join(', ') || '0 kg';

    linesHtml += '<div class="product-line selectable-line">' +
      '<label class="deliver-checkbox">' +
        '<input type="checkbox" class="pending-item-check" data-idx="' + p + '" onchange="updateDeliverBtn()" />' +
      '</label>' +
      '<div class="product-line-info">' +
        '<span class="p-name">📦 ' + pd.product + '</span>' +
        '<span class="p-qty">' + qtyStr + '</span>' +
      '</div>' +
    '</div>';
  }

  var deliverBtnHtml = can('deliver')
    ? '<button class="btn primary small deliver-selected-btn" onclick="deliverSelectedItems()" id="deliverSelectedBtn" disabled>' +
        '<i class="fa fa-check"></i> Deliver (<span id="deliverCount">0</span>)' +
      '</button>'
    : '';

  var selectAllHtml = '<button class="btn small" onclick="toggleSelectAllPending()" id="selectAllPendingBtn" style="width:100%;margin-top:10px;">' +
    '<i class="fa fa-check-square"></i> Select All</button>';

  var html = '<div class="shop-group"><div class="shop-group-head">' +
    '<div style="flex:1;"><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
    '<p><i class="fa fa-phone"></i> ' + shopMobile + ' • ' + formatDate(today) + '</p></div>' +
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
      '<span class="shop-group-total">' + totalKgText(grandTotalKg) + '</span>' +
      deliverBtnHtml +
    '</div>' +
    '</div>' +
    linesHtml +
    selectAllHtml +
    '</div>';

  body.innerHTML = html;
  document.getElementById('pendingShopModal').classList.add('active');
}

function updateDeliverBtn() {
  var checks = document.querySelectorAll('.pending-item-check');
  var count = 0;
  for (var i = 0; i < checks.length; i++) {
    if (checks[i].checked) count++;
  }
  var btn = document.getElementById('deliverSelectedBtn');
  var countSpan = document.getElementById('deliverCount');
  if (countSpan) countSpan.textContent = count;
  if (btn) btn.disabled = (count === 0);
}

function toggleSelectAllPending() {
  var checks = document.querySelectorAll('.pending-item-check');
  var allChecked = true;
  for (var i = 0; i < checks.length; i++) {
    if (!checks[i].checked) { allChecked = false; break; }
  }
  for (var i = 0; i < checks.length; i++) {
    checks[i].checked = !allChecked;
  }
  var btn = document.getElementById('selectAllPendingBtn');
  if (btn) {
    if (allChecked) btn.innerHTML = '<i class="fa fa-check-square"></i> Select All';
    else btn.innerHTML = '<i class="fa fa-square"></i> Deselect All';
  }
  updateDeliverBtn();
}

function deliverSelectedItems() {
  if (!can('deliver')) { alert('Permission nahi hai'); return; }
  var checks = document.querySelectorAll('.pending-item-check');
  var selectedIdx = [];
  for (var i = 0; i < checks.length; i++) {
    if (checks[i].checked) selectedIdx.push(parseInt(checks[i].getAttribute('data-idx')));
  }
  if (selectedIdx.length === 0) { alert('Kam az kam ek product select karein!'); return; }

  var shopId = currentPendingShopId;
  var shop = getShopById(shopId);
  var deliveredItemsForWa = [];

  for (var s = 0; s < selectedIdx.length; s++) {
    var pd = currentPendingProducts[selectedIdx[s]];
    if (!pd) continue;
    for (var i = 0; i < pd.orderIds.length; i++) {
      var oid = pd.orderIds[i];
      var order = null;
      for (var j = 0; j < orders.length; j++) {
        if (orders[j].id == oid) { order = orders[j]; break; }
      }
      if (!order) continue;
      for (var k = 0; k < order.items.length; k++) {
        var it = order.items[k];
        if (it.product !== pd.product) continue;
        it.deliveredMaund = parseInt(it.maund) || 0;
        it.deliveredKg = parseInt(it.kg) || 0;
      }
      order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
      saveToFirebase('orders', order.id, order);
    }
    deliveredItemsForWa.push({
      product: pd.product,
      maund: pd.maund,
      kg: pd.kg,
      kgList: pd.kgList.slice()
    });
  }

  cleanupRouteAfterDelivery();
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();
  refreshPendingShopModal();

  if (shop && shop.mobile && deliveredItemsForWa.length > 0) {
    sendMultiDeliveredWhatsApp(deliveredItemsForWa, shop);
  }
}

function closePendingShopModal() {
  document.getElementById('pendingShopModal').classList.remove('active');
  document.getElementById('pendingShopModal').removeAttribute('data-shop-id');
  currentPendingShopId = null;
  currentPendingProducts = [];
}

function refreshPendingShopModal() {
  var modal = document.getElementById('pendingShopModal');
  if (!modal) return;
  var currentShopId = modal.getAttribute('data-shop-id');
  if (!currentShopId) { closePendingShopModal(); return; }
  var today = todayStr();
  var stillPending = false;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == currentShopId && o.date === today && (o.status === 'Pending' || o.status === 'Partial')) {
      stillPending = true; break;
    }
  }
  if (!stillPending) closePendingShopModal();
  else openPendingShopModal(currentShopId);
}

// ================== SHOPKEEPERS ==================
function saveShopkeeper() {
  if (!can('shopkeepers')) { alert('Permission nahi hai'); return; }
  var id = document.getElementById('shopId').value;
  var name = document.getElementById('shopName').value.trim();
  var mobile = document.getElementById('shopMobile').value.trim();
  var address = document.getElementById('shopAddress').value.trim();
  if (!name || !mobile) { alert('Naam aur mobile zaroori!'); return; }
  if (id) {
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == id) {
        shopkeepers[i].name = name;
        shopkeepers[i].mobile = mobile;
        shopkeepers[i].address = address;
        saveToFirebase('shopkeepers', shopkeepers[i].id, shopkeepers[i]);
      }
    }
    resetShopForm(); renderShopkeepers(); renderDashboard(); renderShopPickerGrid(); renderRouteShopPicker();
    alert('Shopkeeper save!'); return;
  }
  var newShop = { name: name, mobile: mobile, address: address, createdAt: new Date().toISOString() };
  if (firebaseReady) {
    db.collection('shopkeepers').add(newShop).then(function(ref) {
      newShop.id = ref.id;
      shopkeepers.push(newShop);
      resetShopForm(); renderShopkeepers(); renderDashboard(); renderShopPickerGrid(); renderRouteShopPicker();
      alert('Shopkeeper save!');
    }).catch(function(e) { alert('Error: ' + e.message); });
  }
}
function resetShopForm() {
  document.getElementById('shopId').value = '';
  document.getElementById('shopName').value = '';
  document.getElementById('shopMobile').value = '';
  document.getElementById('shopAddress').value = '';
  document.getElementById('shopFormTitle').textContent = 'Naya Shopkeeper Add Karein';
}
function editShopkeeper(id) {
  if (!can('shopkeepers')) { alert('Permission nahi hai'); return; }
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == id) {
      var s = shopkeepers[i];
      document.getElementById('shopId').value = s.id;
      document.getElementById('shopName').value = s.name;
      document.getElementById('shopMobile').value = s.mobile;
      document.getElementById('shopAddress').value = s.address || '';
      document.getElementById('shopFormTitle').textContent = 'Edit Karein';
    }
  }
  window.scrollTo(0, 0);
}
function deleteShopkeeper(id) {
  if (!can('shopkeepers')) { alert('Permission nahi hai'); return; }
  if (!confirm('Pakka delete?')) return;
  var newList = [];
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id != id) newList.push(shopkeepers[i]);
    else deleteFromFirebase('shopkeepers', shopkeepers[i].id);
  }
  shopkeepers = newList;
  renderShopkeepers(); renderDashboard(); renderShopPickerGrid(); renderRouteShopPicker();
}
function renderShopkeepers() {
  var list = document.getElementById('shopkeepersList');
  if (shopkeepers.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-users"></i>Koi shopkeeper nahi.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    var total = 0, pending = 0;
    for (var j = 0; j < orders.length; j++) {
      if (orders[j].shopId == s.id) {
        total++;
        if (orders[j].status === 'Pending' || orders[j].status === 'Partial') pending++;
      }
    }
    var editBtns = '';
    if (can('shopkeepers')) {
      editBtns = '<button class="btn small" onclick="editShopkeeper(\'' + s.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
                 '<button class="btn small danger" onclick="deleteShopkeeper(\'' + s.id + '\')"><i class="fa fa-trash"></i></button>';
    }
    html += '<div class="item"><div class="item-info">' +
      '<h4><i class="fa fa-store"></i> ' + s.name + '</h4>' +
      '<p><i class="fa fa-phone"></i> ' + s.mobile + '</p>' +
      (s.address ? '<p><i class="fa fa-map-marker-alt"></i> ' + s.address + '</p>' : '') +
      '<p><small>' + total + ' total • ' + pending + ' pending</small></p></div>' +
      '<div class="item-actions">' +
      '<button class="btn small" onclick="viewShopHistory(\'' + s.id + '\')"><i class="fa fa-history"></i> History</button>' +
      editBtns + '</div></div>';
  }
  list.innerHTML = html;
  if (!can('shopkeepers')) {
    var form = document.getElementById('shopkeeperFormBox');
    if (form) form.style.display = 'none';
  }
}

// ================== DELIVERY ROUTES ==================
function generateRouteName() {
  var nextNum = routes.length + 1;
  var names = {};
  for (var i = 0; i < routes.length; i++) names[routes[i].name] = true;
  while (names['Route ' + nextNum]) nextNum++;
  return 'Route ' + nextNum;
}
function updateRouteNameField() {
  var el = document.getElementById('routeName');
  if (!el) return;
  var id = document.getElementById('routeId').value;
  if (id) {
    for (var i = 0; i < routes.length; i++) {
      if (routes[i].id == id) { el.value = routes[i].name; return; }
    }
  }
  el.value = generateRouteName();
}
function shopHasTodayPendingOrder(shopId) {
  var today = todayStr();
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (o.date !== today) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    return true;
  }
  return false;
}
function saveRoute() {
  if (!can('routes')) { alert('Permission nahi hai'); return; }
  var id = document.getElementById('routeId').value;
  var name = document.getElementById('routeName').value.trim();
  if (!name) name = generateRouteName();
  if (selectedRouteShops.length === 0) { alert('Kam az kam ek shopkeeper chunein!'); return; }
  var currentRouteId = id || null;
  for (var r = 0; r < routes.length; r++) {
    var route = routes[r];
    if (route.id === currentRouteId) continue;
    var ids = (route.shopIds || []).slice();
    var changed = false;
    var newIds = [];
    for (var i = 0; i < ids.length; i++) {
      if (selectedRouteShops.indexOf(ids[i]) !== -1) changed = true;
      else newIds.push(ids[i]);
    }
    if (changed) {
      route.shopIds = newIds;
      saveToFirebase('routes', route.id, route);
    }
  }
  if (id) {
    for (var i = 0; i < routes.length; i++) {
      if (routes[i].id == id) {
        routes[i].name = name;
        routes[i].shopIds = selectedRouteShops.slice();
        routes[i].updatedAt = new Date().toISOString();
        saveToFirebase('routes', routes[i].id, routes[i]);
      }
    }
    alert('Route update ho gaya!');
    resetRouteForm(); renderRoutes(); renderDashboardRoutes();
    showPage('dashboard');
    return;
  }
  var newRoute = {
    name: name,
    shopIds: selectedRouteShops.slice(),
    createdBy: currentUser ? currentUser.user : 'unknown',
    createdAt: new Date().toISOString()
  };
  if (firebaseReady) {
    db.collection('routes').add(newRoute).then(function(ref) {
      newRoute.id = ref.id;
      routes.push(newRoute);
      alert('Route ban gaya: ' + name);
      resetRouteForm(); renderRoutes(); renderDashboardRoutes();
      showPage('dashboard');
    }).catch(function(e) { alert('Error: ' + e.message); });
  }
}
function resetRouteForm() {
  document.getElementById('routeId').value = '';
  selectedRouteShops = [];
  document.getElementById('routeFormTitle').textContent = 'Naya Route Banayein';
  updateRouteNameField();
  renderRouteShopPicker();
}
function editRoute(id) {
  if (!can('routes')) { alert('Permission nahi hai'); return; }
  for (var i = 0; i < routes.length; i++) {
    if (routes[i].id == id) {
      var r = routes[i];
      document.getElementById('routeId').value = r.id;
      document.getElementById('routeName').value = r.name;
      selectedRouteShops = (r.shopIds || []).slice();
      document.getElementById('routeFormTitle').textContent = 'Route Edit Karein';
      renderRouteShopPicker();
      window.scrollTo(0, 0);
    }
  }
}
function deleteRoute(id) {
  if (!can('routes')) { alert('Permission nahi hai'); return; }
  if (!confirm('Pakka route delete?')) return;
  var newList = [];
  for (var i = 0; i < routes.length; i++) {
    if (routes[i].id != id) newList.push(routes[i]);
    else deleteFromFirebase('routes', routes[i].id);
  }
  routes = newList;
  renderRoutes(); renderDashboardRoutes();
  updateRouteNameField();
}
function renderRouteShopPicker() {
  var box = document.getElementById('routeShopPicker');
  if (!box) return;
  var currentRouteId = document.getElementById('routeId').value || null;
  var visible = [];
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    var hasOrder = shopHasTodayPendingOrder(s.id);
    if (hasOrder) visible.push(s);
  }
  if (visible.length === 0) {
    box.innerHTML = '<div class="route-empty-hint"><i class="fa fa-inbox"></i>Aaj koi shopkeeper ka pending order nahi hai.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < visible.length; i++) {
    var s = visible[i];
    var selected = selectedRouteShops.indexOf(s.id) !== -1;
    var otherRoute = null;
    for (var r = 0; r < routes.length; r++) {
      if (routes[r].id === currentRouteId) continue;
      var ids = routes[r].shopIds || [];
      if (ids.indexOf(s.id) !== -1) { otherRoute = routes[r]; break; }
    }
    var routeBadge = '';
    if (otherRoute && !selected) {
      routeBadge = '<span class="other-route-badge">📍 ' + otherRoute.name + '</span>';
    }
    var orderSummaryText = getShopOrderSummaryText(s.id);
    html += '<label class="route-shop-item ' + (selected ? 'selected' : '') + '">' +
      '<input type="checkbox" ' + (selected ? 'checked' : '') + ' onchange="toggleRouteShop(\'' + s.id + '\', this.checked)" />' +
      '<span class="shop-info">' +
        '<span class="shop-name-line"><i class="fa fa-store"></i> ' + s.name + '</span>' +
        (orderSummaryText ? '<span class="shop-order-summary">📦 ' + orderSummaryText + '</span>' : '') +
      '</span>' +
      routeBadge +
      '</label>';
  }
  box.innerHTML = html;
}
function getShopOrderSummaryText(shopId) {
  var today = todayStr();
  var productMap = {};
  var productOrder = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId != shopId) continue;
    if (o.date !== today) continue;
    if (o.status !== 'Pending' && o.status !== 'Partial') continue;
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      if (remM <= 0 && remK <= 0) continue;
      var pName = it.product;
      if (!productMap[pName]) {
        productMap[pName] = { maund: 0, kgList: [] };
        productOrder.push(pName);
      }
      productMap[pName].maund += remM;
      if (remK > 0) productMap[pName].kgList.push(remK);
    }
  }
  var parts = [];
  for (var p = 0; p < productOrder.length; p++) {
    var name = productOrder[p];
    var data = productMap[name];
    var qtyParts = [];
    if (data.maund > 0) qtyParts.push(data.maund + ' maund');
    for (var k = 0; k < data.kgList.length; k++) qtyParts.push(data.kgList[k] + ' kg');
    if (qtyParts.length === 0) continue;
    parts.push(name + ': ' + qtyParts.join(', '));
  }
  return parts.join(' • ');
}
function toggleRouteShop(shopId, checked) {
  if (checked) {
    if (selectedRouteShops.indexOf(shopId) === -1) selectedRouteShops.push(shopId);
  } else {
    var idx = selectedRouteShops.indexOf(shopId);
    if (idx !== -1) selectedRouteShops.splice(idx, 1);
  }
  var items = document.querySelectorAll('.route-shop-item');
  for (var i = 0; i < items.length; i++) {
    var cb = items[i].querySelector('input[type="checkbox"]');
    if (!cb) continue;
    var oc = cb.getAttribute('onchange') || '';
    if (oc.indexOf("'" + shopId + "'") !== -1) {
      if (checked) items[i].classList.add('selected');
      else items[i].classList.remove('selected');
    }
  }
}
function renderRoutes() {
  var list = document.getElementById('routesList');
  if (!list) return;
  updateRouteNameField();
  if (routes.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-route"></i>Abhi koi route nahi bana.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < routes.length; i++) {
    var r = routes[i];
    var stats = getRouteStats(r);
    var breakdownHtml = renderRouteProductBreakdown(stats.productBreakdown);
    html += '<div class="route-card" onclick="openRouteModal(\'' + r.id + '\')">' +
      '<div class="route-card-head">' +
        '<div class="route-card-name"><i class="fa fa-route"></i> ' + r.name + '</div>' +
      '</div>' +
      '<div class="route-card-stats">' +
        '<span class="route-stat"><i class="fa fa-store"></i> ' + (r.shopIds ? r.shopIds.length : 0) + ' shopkeepers</span>' +
        '<span class="route-stat green"><i class="fa fa-weight-hanging"></i> ' + stats.totalQtyText + '</span>' +
      '</div>' +
      (breakdownHtml ? '<div class="route-breakdown">' + breakdownHtml + '</div>' : '') +
      '<div class="route-actions" onclick="event.stopPropagation()">' +
        '<button class="btn small" onclick="editRoute(\'' + r.id + '\')"><i class="fa fa-edit"></i> Edit</button>' +
        '<button class="btn small danger" onclick="deleteRoute(\'' + r.id + '\')"><i class="fa fa-trash"></i></button>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}
function getRouteStats(route) {
  var totalKg = 0;
  var totalMaund = 0;
  var pendingShopCount = 0;
  var shopIds = route.shopIds || [];
  var productMap = {};
  var productOrder = [];
  for (var i = 0; i < shopIds.length; i++) {
    var sid = shopIds[i];
    var hasPending = false;
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.shopId != sid) continue;
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
      hasPending = true;
      for (var k = 0; k < o.items.length; k++) {
        var it = o.items[k];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        totalKg += (remM * 40) + remK;
        totalMaund += remM;
        var pName = it.product;
        if (!productMap[pName]) {
          productMap[pName] = { maund: 0, kgList: [] };
          productOrder.push(pName);
        }
        productMap[pName].maund += remM;
        if (remK > 0) productMap[pName].kgList.push(remK);
      }
    }
    if (hasPending) pendingShopCount++;
  }
  var breakdown = [];
  for (var p = 0; p < productOrder.length; p++) {
    var name = productOrder[p];
    var data = productMap[name];
    breakdown.push({ product: name, maund: data.maund, kgList: data.kgList });
  }
  return {
    totalKg: totalKg,
    totalMaund: totalMaund,
    totalQtyText: totalKgText(totalKg),
    pendingShopCount: pendingShopCount,
    productBreakdown: breakdown
  };
}
function renderRouteProductBreakdown(breakdown) {
  if (!breakdown || breakdown.length === 0) return '';
  var html = '';
  for (var i = 0; i < breakdown.length; i++) {
    var b = breakdown[i];
    var parts = [];
    if (b.maund > 0) parts.push(b.maund + ' maund');
    for (var k = 0; k < b.kgList.length; k++) parts.push(b.kgList[k] + ' kg');
    if (parts.length === 0) continue;
    html += '<div class="route-breakdown-line">' +
      '<span class="rb-name">📦 ' + b.product + '</span>' +
      '<span class="rb-qty">' + parts.join(', ') + '</span>' +
    '</div>';
  }
  return html;
}
function renderDashboardRoutes() {
  var list = document.getElementById('dashboardRoutesList');
  var badge = document.getElementById('routesBadge');
  if (!list) return;
  var visibleRoutes = [];
  for (var i = 0; i < routes.length; i++) {
    var stats = getRouteStats(routes[i]);
    if (stats.pendingShopCount > 0) visibleRoutes.push({ route: routes[i], stats: stats });
  }
  if (badge) badge.textContent = visibleRoutes.length;
  if (visibleRoutes.length === 0) {
    if (routes.length === 0) {
      list.innerHTML = '<div class="empty"><i class="fa fa-route"></i>Abhi koi route nahi. "Delivery Route Add" se banao.</div>';
    } else {
      list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Aaj koi route pending nahi. Sab deliver ho gaya!</div>';
    }
    return;
  }
  var html = '';
  for (var i = 0; i < visibleRoutes.length; i++) {
    var r = visibleRoutes[i].route;
    var stats = visibleRoutes[i].stats;
    var breakdownHtml = renderRouteProductBreakdown(stats.productBreakdown);
    html += '<div class="route-card" onclick="openRouteModal(\'' + r.id + '\')">' +
      '<div class="route-card-head">' +
        '<div class="route-card-name"><i class="fa fa-route"></i> ' + r.name + '</div>' +
        '<i class="fa fa-chevron-right" style="color:#6366f1;"></i>' +
      '</div>' +
      '<div class="route-card-stats">' +
        '<span class="route-stat"><i class="fa fa-store"></i> ' + (r.shopIds ? r.shopIds.length : 0) + ' shops</span>' +
        '<span class="route-stat"><i class="fa fa-clock"></i> ' + stats.pendingShopCount + ' pending</span>' +
        '<span class="route-stat green"><i class="fa fa-weight-hanging"></i> ' + stats.totalQtyText + '</span>' +
      '</div>' +
      (breakdownHtml ? '<div class="route-breakdown">' + breakdownHtml + '</div>' : '') +
    '</div>';
  }
  list.innerHTML = html;
}
function openRouteModal(routeId) {
  var route = null;
  for (var i = 0; i < routes.length; i++) {
    if (routes[i].id == routeId) route = routes[i];
  }
  if (!route) return;
  document.getElementById('routeModalTitle').textContent = route.name;
  var body = document.getElementById('routeModalBody');
  var shopIds = route.shopIds || [];
  var stats = getRouteStats(route);
  if (shopIds.length === 0) {
    body.innerHTML = '<div class="empty">Is route mein koi shopkeeper nahi.</div>';
    document.getElementById('routeModal').classList.add('active');
    return;
  }
  var html = '';
  var grandTotalKg = 0;
  for (var i = 0; i < shopIds.length; i++) {
    var sid = shopIds[i];
    var shop = null;
    for (var j = 0; j < shopkeepers.length; j++) {
      if (shopkeepers[j].id == sid) shop = shopkeepers[j];
    }
    if (!shop) continue;
    var productMap = {};
    var productOrder = [];
    var shopTotalKg = 0;
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.shopId != sid) continue;
      if (o.status !== 'Pending' && o.status !== 'Partial') continue;
      for (var k = 0; k < o.items.length; k++) {
        var it = o.items[k];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        shopTotalKg += (remM * 40) + remK;
        var pName = it.product;
        if (!productMap[pName]) {
          productMap[pName] = { maund: 0, kgList: [] };
          productOrder.push(pName);
        }
        productMap[pName].maund += remM;
        if (remK > 0) productMap[pName].kgList.push(remK);
      }
    }
    if (productOrder.length === 0) continue;
    grandTotalKg += shopTotalKg;
    var itemsHtml = '';
    for (var p = 0; p < productOrder.length; p++) {
      var pName = productOrder[p];
      var pdata = productMap[pName];
      var qtyParts = [];
      if (pdata.maund > 0) qtyParts.push(pdata.maund + ' maund');
      for (var q = 0; q < pdata.kgList.length; q++) qtyParts.push(pdata.kgList[q] + ' kg');
      var qtyStr = qtyParts.join(', ') || '0 kg';
      itemsHtml += '<div class="route-product-line">' +
        '<span class="rp-name">📦 ' + pName + '</span>' +
        '<span class="rp-qty">' + qtyStr + '</span>' +
      '</div>';
    }
    html += '<div class="route-detail-shop">' +
      '<div class="route-detail-shop-head">' +
        '<h4><i class="fa fa-store"></i> ' + shop.name + '</h4>' +
        '<span class="qty-pill">' + totalKgText(shopTotalKg) + '</span>' +
      '</div>' +
      '<p style="font-size:13px;color:#64748b;margin-bottom:8px;"><i class="fa fa-phone"></i> ' + shop.mobile + '</p>' +
      '<div class="route-detail-items">' + itemsHtml + '</div>' +
    '</div>';
  }
  if (html === '') {
    body.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Is route ke sab orders deliver ho gaye!</div>';
    document.getElementById('routeModal').classList.add('active');
    return;
  }
  var breakdownHtml = renderRouteProductBreakdown(stats.productBreakdown);
  html += '<div class="load-summary route-total-summary" style="margin-top:18px;margin-bottom:0;">' +
    '<div style="width:100%;">' +
      '<p>Route Ka Total Load</p>' +
      '<div class="big-num" style="margin-bottom:12px;">' + totalKgText(grandTotalKg) + '</div>' +
      (breakdownHtml ? '<div class="route-total-breakdown">' + breakdownHtml + '</div>' : '') +
    '</div>' +
    '<div style="text-align:right;border-top:1px solid rgba(255,255,255,0.2);padding-top:12px;width:100%;margin-top:12px;">' +
      '<p>Shopkeepers</p>' +
      '<div class="big-num">' + shopIds.length + '</div>' +
    '</div>' +
  '</div>';
  body.innerHTML = html;
  document.getElementById('routeModal').classList.add('active');
}
function closeRouteModal() {
  document.getElementById('routeModal').classList.remove('active');
}

// ================== NEW ORDER (3-STEP) ==================
function prepareOrderForm() {
  selectedShopIdForOrder = null;
  selectedProductForOrder = null;
  selectedEditIndex = -1;
  currentOrderItems = [];
  showNewOrderStep(1);
  var notesEl = document.getElementById('orderNotes');
  if (notesEl) notesEl.value = '';
}
function showNewOrderStep(step) {
  var step1 = document.getElementById('shopPickerStep');
  var step2 = document.getElementById('productPickerStep');
  var step3 = document.getElementById('quantityStep');
  var heading = document.getElementById('newOrderHeading');
  var sub = document.getElementById('newOrderSub');
  step1.style.display = 'none';
  step2.style.display = 'none';
  step3.style.display = 'none';
  if (step === 1) {
    step1.style.display = 'block';
    if (heading) heading.textContent = 'Naya Order';
    if (sub) sub.textContent = 'Pehle shopkeeper chunein';
    renderShopPickerGrid();
  } else if (step === 2) {
    step2.style.display = 'block';
    if (heading) heading.textContent = 'Products Chunein';
    if (sub) sub.textContent = 'Product pe tap karke quantity add karein';
    renderProductPickerGrid();
    renderAddedProducts();
  } else if (step === 3) {
    step3.style.display = 'block';
    if (heading) heading.textContent = 'Quantity Daalein';
    if (sub) sub.textContent = 'Maund aur Kg alag alag likhein';
  }
  window.scrollTo(0, 0);
}
function renderShopPickerGrid() {
  var grid = document.getElementById('shopPickerGrid');
  if (!grid) return;
  if (shopkeepers.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1;"><i class="fa fa-users"></i>Pehle shopkeeper add karein (Shopkeepers page se).</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    var s = shopkeepers[i];
    html += '<div class="shop-picker-card" onclick="selectShopkeeperForOrder(\'' + s.id + '\')">' +
      '<div class="sp-icon"><i class="fa fa-store"></i></div>' +
      '<div class="sp-name">' + s.name + '</div>' +
      '<div class="sp-mobile"><i class="fa fa-phone"></i> ' + s.mobile + '</div>' +
      (s.address ? '<div class="sp-address"><i class="fa fa-map-marker-alt"></i> ' + s.address + '</div>' : '') +
      '</div>';
  }
  grid.innerHTML = html;
}
function selectShopkeeperForOrder(shopId) {
  selectedShopIdForOrder = shopId;
  currentOrderItems = [];
  var shop = null;
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == shopId) shop = shopkeepers[i];
  }
  if (!shop) return;
  document.getElementById('selectedShopName').textContent = shop.name;
  document.getElementById('selectedShopMobile').innerHTML = '<i class="fa fa-phone"></i> ' + shop.mobile;
  showNewOrderStep(2);
}
function changeShopkeeper() {
  if (currentOrderItems.length > 0) {
    if (!confirm('Shopkeeper change karne se add kiye gaye products hat jayenge. Continue?')) return;
  }
  selectedShopIdForOrder = null;
  currentOrderItems = [];
  showNewOrderStep(1);
}
function renderProductPickerGrid() {
  var grid = document.getElementById('productPickerGrid');
  if (!grid) return;
  if (products.length === 0) {
    grid.innerHTML = '<div class="empty" style="grid-column: 1 / -1;"><i class="fa fa-box"></i>Koi product nahi. Pehle Settings mein product add karein.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var count = 0;
    for (var j = 0; j < currentOrderItems.length; j++) {
      if (currentOrderItems[j].product === p) count++;
    }
    var added = count > 0;
    var badgeHtml = '';
    if (added) badgeHtml = '<span class="pp-count-badge">' + count + '</span>';
    html += '<div class="product-picker-card' + (added ? ' added' : '') + '" onclick="selectProductForOrder(\'' + p.replace(/'/g, "\\'") + '\')">' +
      badgeHtml +
      '<div class="pp-icon"><i class="fa fa-box"></i></div>' +
      '<div class="pp-name">' + p + '</div>' +
      '</div>';
  }
  grid.innerHTML = html;
}
function selectProductForOrder(productName) {
  var existingIndexes = [];
  for (var i = 0; i < currentOrderItems.length; i++) {
    if (currentOrderItems[i].product === productName) existingIndexes.push(i);
  }
  if (existingIndexes.length > 0) {
    var choice = confirm(productName + ' pehle se ' + existingIndexes.length + ' baar add hai.\n\nOK = NAYA ADD karein\nCancel = EDIT karein');
    if (choice) {
      selectedProductForOrder = productName;
      selectedEditIndex = -1;
      document.getElementById('qtyProductName').textContent = productName;
      document.getElementById('qtyMaund').value = '';
      document.getElementById('qtyKg').value = '';
      updateQtyPreview();
      showNewOrderStep(3);
    } else {
      if (existingIndexes.length === 1) editAddedProduct(existingIndexes[0]);
      else alert('Is product ki ' + existingIndexes.length + ' entries hain. Neeche list se edit karein.');
    }
  } else {
    selectedProductForOrder = productName;
    selectedEditIndex = -1;
    document.getElementById('qtyProductName').textContent = productName;
    document.getElementById('qtyMaund').value = '';
    document.getElementById('qtyKg').value = '';
    updateQtyPreview();
    showNewOrderStep(3);
  }
}
function updateQtyPreview() {
  var m = parseInt(document.getElementById('qtyMaund').value) || 0;
  var k = parseInt(document.getElementById('qtyKg').value) || 0;
  var totalKg = (m * 40) + k;
  document.getElementById('qtyPreviewText').textContent = totalKgText(totalKg);
}
function cancelQty() {
  selectedProductForOrder = null;
  selectedEditIndex = -1;
  showNewOrderStep(2);
}
function confirmQtyAdd() {
  var m = parseInt(document.getElementById('qtyMaund').value) || 0;
  var k = parseInt(document.getElementById('qtyKg').value) || 0;
  if (m === 0 && k === 0) { alert('Kam az kam maund ya kg daalein!'); return; }
  if (k > 39) { alert('Kg 39 se zyada nahi ho sakta.'); return; }
  if (selectedEditIndex >= 0 && selectedEditIndex < currentOrderItems.length) {
    currentOrderItems[selectedEditIndex].maund = m;
    currentOrderItems[selectedEditIndex].kg = k;
  } else {
    currentOrderItems.push({ product: selectedProductForOrder, maund: m, kg: k });
  }
  selectedProductForOrder = null;
  selectedEditIndex = -1;
  showNewOrderStep(2);
}
function renderAddedProducts() {
  var box = document.getElementById('addedProductsBox');
  var list = document.getElementById('addedProductsList');
  var count = document.getElementById('addedProductsCount');
  if (!box || !list) return;
  if (currentOrderItems.length === 0) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  if (count) count.textContent = currentOrderItems.length;
  var html = '';
  for (var i = 0; i < currentOrderItems.length; i++) {
    var it = currentOrderItems[i];
    html += '<div class="added-product-row">' +
      '<div class="ap-name"><i class="fa fa-check-circle"></i> ' + it.product + '</div>' +
      '<div class="ap-qty">' + qtyText(it.maund, it.kg) + '</div>' +
      '<div class="ap-actions">' +
        '<button class="btn small" onclick="editAddedProduct(' + i + ')"><i class="fa fa-edit"></i></button>' +
        '<button class="btn small danger" onclick="removeAddedProduct(' + i + ')"><i class="fa fa-trash"></i></button>' +
      '</div>' +
      '</div>';
  }
  list.innerHTML = html;
}
function editAddedProduct(idx) {
  var it = currentOrderItems[idx];
  selectedProductForOrder = it.product;
  selectedEditIndex = idx;
  document.getElementById('qtyProductName').textContent = it.product;
  document.getElementById('qtyMaund').value = it.maund > 0 ? it.maund : '';
  document.getElementById('qtyKg').value = it.kg > 0 ? it.kg : '';
  updateQtyPreview();
  showNewOrderStep(3);
}
function removeAddedProduct(idx) {
  currentOrderItems.splice(idx, 1);
  renderAddedProducts();
  renderProductPickerGrid();
}
function saveMultiOrder() {
  if (!can('newOrder')) { alert('Permission nahi hai'); return; }
  if (!selectedShopIdForOrder) { alert('Pehle shopkeeper chunein!'); return; }
  if (currentOrderItems.length === 0) { alert('Kam az kam ek product add karein!'); return; }
  var shopId = selectedShopIdForOrder;
  var date = todayStr();
  var notes = document.getElementById('orderNotes').value.trim();
  var items = [];
  var totalKg = 0;
  for (var i = 0; i < currentOrderItems.length; i++) {
    var it = currentOrderItems[i];
    var rowKg = (it.maund * 40) + it.kg;
    items.push({ product: it.product, maund: it.maund, kg: it.kg, deliveredMaund: 0, deliveredKg: 0, totalKg: rowKg });
    totalKg += rowKg;
  }
  var newOrder = {
    shopId: shopId, items: items, totalKg: totalKg, date: date,
    notes: notes, status: 'Pending',
    createdBy: currentUser ? currentUser.user : 'unknown',
    createdAt: new Date().toISOString()
  };
  if (firebaseReady) {
    db.collection('orders').add(newOrder).then(function(ref) {
      newOrder.id = ref.id;
      orders.push(newOrder);
      prepareOrderForm();
      renderDashboard();
      renderRouteShopPicker();
      showPage('dashboard');
      var shop = getShopById(shopId);
      if (shop && shop.mobile) {
        sendOrderWhatsApp(newOrder, shop);
      }
    }).catch(function(e) { alert('Error: ' + e.message); });
  }
}
function newOrderBack() {
  var step3 = document.getElementById('quantityStep');
  if (step3 && step3.style.display === 'block') { cancelQty(); return; }
  var step2 = document.getElementById('productPickerStep');
  if (step2 && step2.style.display === 'block') {
    if (currentOrderItems.length > 0) {
      if (!confirm('Add kiye gaye products save nahi hue. Wapas shopkeeper chunne jaana hai?')) return;
    }
    changeShopkeeper();
    return;
  }
  showPage('dashboard');
}

// ================== ORDERS PAGE ==================
function renderOrdersPage() {
  var dateVal = document.getElementById('ordersDate').value || todayStr();
  var statusFilter = document.getElementById('ordersStatus').value;
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.date !== dateVal) continue;
    if (statusFilter === 'Pending' && o.status === 'Delivered') continue;
    if (statusFilter === 'Delivered' && o.status !== 'Delivered') continue;
    filtered.push(o);
  }
  var list = document.getElementById('ordersList');
  var summary = document.getElementById('ordersSummary');
  if (filtered.length === 0) {
    summary.innerHTML = '<div><p>' + formatDate(dateVal) + ' ka load</p><div class="big-num">0 kg</div></div>';
    list.innerHTML = '<div class="empty"><i class="fa fa-truck"></i>Is din koi order nahi.</div>';
    return;
  }
  var totalKg = 0;
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i];
    for (var j = 0; j < o.items.length; j++) {
      var it = o.items[j];
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      totalKg += (remM * 40) + remK;
    }
  }
  summary.innerHTML = '<div><p>' + formatDate(dateVal) + ' ka baqi load</p><div class="big-num">' + totalKgText(totalKg) + '</div></div>';
  var grouped = {};
  for (var i = 0; i < filtered.length; i++) {
    var sid = filtered[i].shopId;
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push(filtered[i]);
  }
  var html = '';
  var keys = Object.keys(grouped);
  for (var k = 0; k < keys.length; k++) {
    var shopId = keys[k];
    var shopName = 'Unknown', shopAddress = '—', shopMobile = '';
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == shopId) {
        shopName = shopkeepers[i].name;
        shopAddress = shopkeepers[i].address || '—';
        shopMobile = shopkeepers[i].mobile;
      }
    }
    var sOrders = grouped[shopId];
    var shopKg = 0;
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        shopKg += (remM * 40) + remK;
      }
    }
    var linesHtml = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        var deliveredText = '';
        if (it.deliveredMaund > 0 || it.deliveredKg > 0) {
          deliveredText = '<div class="p-delivered">✓ ' + qtyText(it.deliveredMaund, it.deliveredKg) + ' deliver ho chuka</div>';
        }
        var action = can('deliver')
          ? '<button class="btn small success" onclick="openDeliverModal(\'' + o.id + '\', \'' + it.product.replace(/'/g, "\\'") + '\')"><i class="fa fa-check"></i> Delivered</button>'
          : '';
        linesHtml += '<div class="product-line"><div class="product-line-info">' +
          '<span class="p-name">📦 ' + it.product + '</span>' +
          '<span class="p-qty">' + qtyText(remM, remK) + '</span>' + deliveredText +
          '</div>' + action + '</div>';
      }
    }
    html += '<div class="shop-group"><div class="shop-group-head">' +
      '<div><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
      '<p><i class="fa fa-map-marker-alt"></i> ' + shopAddress + ' • <i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
      '<span class="shop-group-total">' + totalKgText(shopKg) + '</span></div>' + linesHtml + '</div>';
  }
  list.innerHTML = html;
}

// ================== DELIVER MODAL ==================
function openDeliverModal(orderId, product) {
  if (!can('deliver')) { alert('Permission nahi hai'); return; }
  currentDeliverOrderId = orderId;
  currentDeliverProduct = product;
  currentCombinedProduct = null;
  currentCombinedOrderIds = [];
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == orderId) order = orders[i]; }
  if (!order) return;
  var shopName = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == order.shopId) shopName = shopkeepers[i].name;
  }
  document.getElementById('deliverTitle').textContent = product + ' - ' + shopName;
  var pending = getPendingItemsForProduct(order, product);
  var body = document.getElementById('deliverBody');
  var html = '';
  for (var i = 0; i < pending.length; i++) {
    var p = pending[i];
    html += '<div class="deliver-row"><div class="deliver-row-head">Baqi: ' + qtyText(p.maund, p.kg) + '</div>' +
      '<div class="deliver-row-sub">Kitna deliver? (khaali chhoro to poora)</div>' +
      '<div class="deliver-qty-row">' +
      '<div class="form-group"><label>Maund</label><input type="number" class="deliver-maund" min="0" max="' + p.maund + '" placeholder="' + p.maund + '" data-idx="' + p.index + '" /></div>' +
      '<div class="form-group"><label>Kg</label><input type="number" class="deliver-kg" min="0" max="' + p.kg + '" placeholder="' + p.kg + '" data-idx="' + p.index + '" /></div>' +
      '</div></div>';
  }
  body.innerHTML = html;
  document.getElementById('deliverModal').classList.add('active');
}
function closeDeliverModal() {
  document.getElementById('deliverModal').classList.remove('active');
  currentDeliverOrderId = null;
  currentDeliverProduct = null;
  currentCombinedProduct = null;
  currentCombinedOrderIds = [];
}
function confirmDelivery() {
  if (!can('deliver')) return;
  if (!currentDeliverOrderId || !currentDeliverProduct) return;
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentDeliverOrderId) order = orders[i]; }
  if (!order) return;
  var maundInputs = document.querySelectorAll('.deliver-maund');
  var kgInputs = document.querySelectorAll('.deliver-kg');
  for (var i = 0; i < maundInputs.length; i++) {
    var idx = parseInt(maundInputs[i].getAttribute('data-idx'));
    var dm = parseInt(maundInputs[i].value);
    var dk = parseInt(kgInputs[i].value);
    var it = order.items[idx];
    var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
    var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
    if (isNaN(dm)) dm = remM;
    if (isNaN(dk)) dk = remK;
    if (dm > remM) dm = remM;
    if (dk > remK) dk = remK;
    if (dm < 0) dm = 0;
    if (dk < 0) dk = 0;
    it.deliveredMaund = (parseInt(it.deliveredMaund) || 0) + dm;
    it.deliveredKg = (parseInt(it.deliveredKg) || 0) + dk;
  }
  order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
  saveToFirebase('orders', order.id, order);
  closeDeliverModal();
  cleanupRouteAfterDelivery();
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();
  var pm = document.getElementById('pendingShopModal');
  if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var shop = getShopById(order.shopId);
  if (shop && shop.mobile) {
    sendDeliveredWhatsApp(order, shop);
  }
}
function markAllDelivered() {
  if (!can('deliver')) return;
  if (!currentDeliverOrderId || !currentDeliverProduct) return;
  var order = null;
  for (var i = 0; i < orders.length; i++) { if (orders[i].id == currentDeliverOrderId) order = orders[i]; }
  if (!order) return;
  for (var i = 0; i < order.items.length; i++) {
    var it = order.items[i];
    if (it.product === currentDeliverProduct) {
      it.deliveredMaund = parseInt(it.maund) || 0;
      it.deliveredKg = parseInt(it.kg) || 0;
    }
  }
  order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
  saveToFirebase('orders', order.id, order);
  closeDeliverModal();
  cleanupRouteAfterDelivery();
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();
  var pm = document.getElementById('pendingShopModal');
  if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  var shop = getShopById(order.shopId);
  if (shop && shop.mobile) {
    sendDeliveredWhatsApp(order, shop);
  }
}
function confirmDeliverySmart() {
  if (currentCombinedProduct) confirmCombinedDelivery();
  else confirmDelivery();
}
function markAllDeliveredSmart() {
  if (currentCombinedProduct) markAllCombinedDelivered();
  else markAllDelivered();
}
function openCombinedDeliverModal(productName, orderIds) {
  if (!can('deliver')) { alert('Permission nahi hai'); return; }
  currentCombinedProduct = productName;
  currentCombinedOrderIds = orderIds || [];
  var totalM = 0, totalK = 0;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    var oid = currentCombinedOrderIds[i];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.id != oid) continue;
      for (var k = 0; k < o.items.length; k++) {
        var it = o.items[k];
        if (it.product !== productName) continue;
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        totalM += remM;
        totalK += remK;
      }
    }
  }
  var shopName = '';
  var shopIdForName = null;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    for (var j = 0; j < orders.length; j++) {
      if (orders[j].id == currentCombinedOrderIds[i]) {
        shopIdForName = orders[j].shopId;
        break;
      }
    }
    if (shopIdForName) break;
  }
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == shopIdForName) shopName = shopkeepers[i].name;
  }
  document.getElementById('deliverTitle').textContent = productName + ' - ' + shopName;
  var body = document.getElementById('deliverBody');
  var html = '<div class="deliver-row">' +
    '<div class="deliver-row-head">Baqi: ' + qtyText(totalM, totalK) + '</div>' +
    '<div class="deliver-row-sub">Kitna deliver? (khaali chhoro to poora)</div>' +
    '<div class="deliver-qty-row">' +
      '<div class="form-group"><label>Maund</label>' +
        '<input type="number" class="combined-maund" min="0" max="' + totalM + '" placeholder="' + totalM + '" />' +
      '</div>' +
      '<div class="form-group"><label>Kg</label>' +
        '<input type="number" class="combined-kg" min="0" max="' + totalK + '" placeholder="' + totalK + '" />' +
      '</div>' +
    '</div>' +
  '</div>';
  body.innerHTML = html;
  document.getElementById('deliverModal').classList.add('active');
}
function confirmCombinedDelivery() {
  if (!can('deliver')) return;
  if (!currentCombinedProduct) return;
  var mInput = document.querySelector('.combined-maund');
  var kInput = document.querySelector('.combined-kg');
  var dm = mInput ? parseInt(mInput.value) : NaN;
  var dk = kInput ? parseInt(kInput.value) : NaN;
  var totalM = 0, totalK = 0;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    var oid = currentCombinedOrderIds[i];
    for (var j = 0; j < orders.length; j++) {
      var o = orders[j];
      if (o.id != oid) continue;
      for (var k = 0; k < o.items.length; k++) {
        var it = o.items[k];
        if (it.product !== currentCombinedProduct) continue;
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        totalM += remM;
        totalK += remK;
      }
    }
  }
  if (isNaN(dm)) dm = totalM;
  if (isNaN(dk)) dk = totalK;
  if (dm > totalM) dm = totalM;
  if (dk > totalK) dk = totalK;
  if (dm < 0) dm = 0;
  if (dk < 0) dk = 0;
  var remainingM = dm, remainingK = dk;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    if (remainingM <= 0 && remainingK <= 0) break;
    var oid = currentCombinedOrderIds[i];
    var order = null;
    for (var j = 0; j < orders.length; j++) {
      if (orders[j].id == oid) { order = orders[j]; break; }
    }
    if (!order) continue;
    for (var k = 0; k < order.items.length; k++) {
      if (remainingM <= 0 && remainingK <= 0) break;
      var it = order.items[k];
      if (it.product !== currentCombinedProduct) continue;
      var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
      var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
      if (remM <= 0 && remK <= 0) continue;
      var giveM = Math.min(remM, remainingM);
      var giveK = Math.min(remK, remainingK);
      it.deliveredMaund = (parseInt(it.deliveredMaund) || 0) + giveM;
      it.deliveredKg = (parseInt(it.deliveredKg) || 0) + giveK;
      remainingM -= giveM;
      remainingK -= giveK;
    }
    order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
    saveToFirebase('orders', order.id, order);
  }
  var waShop = null;
  var waOrder = null;
  if (currentCombinedOrderIds.length > 0) {
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].id == currentCombinedOrderIds[0]) { waOrder = orders[i]; break; }
    }
    if (waOrder) waShop = getShopById(waOrder.shopId);
  }
  closeDeliverModal();
  cleanupRouteAfterDelivery();
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();
  var pm = document.getElementById('pendingShopModal');
  if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  if (waShop && waShop.mobile && waOrder) {
    sendDeliveredWhatsApp(waOrder, waShop);
  }
}
function markAllCombinedDelivered() {
  if (!can('deliver')) return;
  if (!currentCombinedProduct) return;
  for (var i = 0; i < currentCombinedOrderIds.length; i++) {
    var oid = currentCombinedOrderIds[i];
    var order = null;
    for (var j = 0; j < orders.length; j++) {
      if (orders[j].id == oid) { order = orders[j]; break; }
    }
    if (!order) continue;
    for (var k = 0; k < order.items.length; k++) {
      var it = order.items[k];
      if (it.product !== currentCombinedProduct) continue;
      it.deliveredMaund = parseInt(it.maund) || 0;
      it.deliveredKg = parseInt(it.kg) || 0;
    }
    order.status = checkOrderDelivered(order) ? 'Delivered' : 'Partial';
    saveToFirebase('orders', order.id, order);
  }
  var waShop = null;
  var waOrder = null;
  if (currentCombinedOrderIds.length > 0) {
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].id == currentCombinedOrderIds[0]) { waOrder = orders[i]; break; }
    }
    if (waOrder) waShop = getShopById(waOrder.shopId);
  }
  closeDeliverModal();
  cleanupRouteAfterDelivery();
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();
  var pm = document.getElementById('pendingShopModal');
  if (pm && pm.classList.contains('active')) refreshPendingShopModal();
  if (waShop && waShop.mobile && waOrder) {
    sendDeliveredWhatsApp(waOrder, waShop);
  }
}

// ================== DELIVERY PAGE ==================
function renderDelivery() {
  var pending = [];
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].status === 'Pending' || orders[i].status === 'Partial') pending.push(orders[i]);
  }
  var list = document.getElementById('deliveryList');
  if (pending.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-check-circle"></i>Koi pending order nahi!</div>';
    return;
  }
  var grouped = {};
  for (var i = 0; i < pending.length; i++) {
    var sid = pending[i].shopId;
    if (!grouped[sid]) grouped[sid] = [];
    grouped[sid].push(pending[i]);
  }
  var html = '';
  var keys = Object.keys(grouped);
  for (var k = 0; k < keys.length; k++) {
    var shopId = keys[k];
    var shopName = 'Unknown', shopMobile = '';
    for (var i = 0; i < shopkeepers.length; i++) {
      if (shopkeepers[i].id == shopId) { shopName = shopkeepers[i].name; shopMobile = shopkeepers[i].mobile; }
    }
    var sOrders = grouped[shopId];
    var totalKg = 0;
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        totalKg += (remM * 40) + remK;
      }
    }
    var linesHtml = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        if (remM <= 0 && remK <= 0) continue;
        var deliveredText = '';
        if (it.deliveredMaund > 0 || it.deliveredKg > 0) {
          deliveredText = '<div class="p-delivered">✓ ' + qtyText(it.deliveredMaund, it.deliveredKg) + ' deliver ho chuka</div>';
        }
        var action = can('deliver')
          ? '<button class="btn small success" onclick="openDeliverModal(\'' + o.id + '\', \'' + it.product.replace(/'/g, "\\'") + '\')"><i class="fa fa-check"></i> Delivered</button>'
          : '';
        linesHtml += '<div class="product-line"><div class="product-line-info">' +
          '<span class="p-name">📦 ' + it.product + '</span>' +
          '<span class="p-qty">' + qtyText(remM, remK) + '</span>' + deliveredText +
          '</div>' + action + '</div>';
      }
    }
    html += '<div class="shop-group"><div class="shop-group-head">' +
      '<div><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
      '<p><i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
      '<span class="shop-group-total">' + totalKgText(totalKg) + '</span></div>' + linesHtml + '</div>';
  }
  list.innerHTML = html;
}

// ================== HISTORY ==================
function renderHistory() {
  var searchEl = document.getElementById('historySearch');
  var dateEl = document.getElementById('historyDate');
  var search = searchEl ? searchEl.value.toLowerCase() : '';
  var dateFilter = dateEl ? dateEl.value : '';
  var filtered = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.status !== 'Delivered') continue;
    if (dateFilter && o.date !== dateFilter) continue;
    if (search) {
      var shopName = '';
      for (var j = 0; j < shopkeepers.length; j++) {
        if (shopkeepers[j].id == o.shopId) shopName = shopkeepers[j].name.toLowerCase();
      }
      if (shopName.indexOf(search) === -1) continue;
    }
    filtered.push(o);
  }
  filtered.reverse();
  var list = document.getElementById('historyList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-clock"></i>Koi history nahi.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var o = filtered[i];
    var shopName = 'Unknown';
    for (var j = 0; j < shopkeepers.length; j++) {
      if (shopkeepers[j].id == o.shopId) shopName = shopkeepers[j].name;
    }
    var itemsHtml = '';
    for (var j = 0; j < o.items.length; j++) {
      itemsHtml += '<p>• ' + o.items[j].product + ' — <b>' + qtyText(o.items[j].maund, o.items[j].kg) + '</b></p>';
    }
    html += '<div class="item delivered-item"><div class="item-info">' +
      '<h4>' + shopName + '</h4>' + itemsHtml +
      '<p class="date-line"><i class="fa fa-calendar"></i> ' + formatDate(o.date) + '</p>' +
      '<span class="badge delivered">Delivered</span></div></div>';
  }
  list.innerHTML = html;
}
function clearHistoryFilter() {
  document.getElementById('historySearch').value = '';
  document.getElementById('historyDate').value = '';
  renderHistory();
}

// ================== SHOP HISTORY MODAL ==================
function viewShopHistory(shopId) {
  var shopName = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == shopId) shopName = shopkeepers[i].name;
  }
  var sOrders = [];
  for (var i = 0; i < orders.length; i++) {
    if (orders[i].shopId == shopId) sOrders.push(orders[i]);
  }
  sOrders.reverse();
  document.getElementById('modalTitle').textContent = shopName + ' - Orders';
  var body = document.getElementById('modalBody');
  if (sOrders.length === 0) {
    body.innerHTML = '<div class="empty">Abhi koi order nahi.</div>';
  } else {
    var html = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      var itemsHtml = '';
      for (var j = 0; j < o.items.length; j++) {
        itemsHtml += '<p><b>' + o.items[j].product + '</b> — ' + qtyText(o.items[j].maund, o.items[j].kg) + '</p>';
      }
      var st = o.status.toLowerCase();
      if (o.status === 'Partial') st = 'partial';
      html += '<div class="item ' + (o.status === 'Delivered' ? 'delivered-item' : 'pending-item') + '" style="margin-bottom:10px;">' +
        '<div class="item-info">' + itemsHtml +
        '<p><small>' + formatDate(o.date) + '</small></p>' +
        '<span class="badge ' + st + '">' + o.status + '</span></div></div>';
    }
    body.innerHTML = html;
  }
  document.getElementById('modal').classList.add('active');
}
function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

// ================== INIT ==================
window.addEventListener('load', function() {
  applySettings();
  initFirebase(function() {
    loadAllData(function() {
      autoShiftPendingOrders();

      var loggedIn = localStorage.getItem('isLoggedIn') === 'true';
      var cachedUser = JSON.parse(localStorage.getItem('currentUser'));

      if (loggedIn && cachedUser) {
        var found = null;
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === cachedUser.id) { found = users[i]; break; }
        }
        if (found) {
          currentUser = found;
          isLoggedIn = true;
          if (currentUser.pin && String(currentUser.pin).length === 4) {
            showPinScreen();
            return;
          } else {
            showApp();
            return;
          }
        }
      }
      isLoggedIn = false;
      localStorage.setItem('isLoggedIn', 'false');
      localStorage.removeItem('currentUser');
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('appWrapper').style.display = 'none';
      document.getElementById('pinScreen').style.display = 'none';
    });
  });
});
