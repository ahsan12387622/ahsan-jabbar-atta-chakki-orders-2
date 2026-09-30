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
var settings = { bizName: 'Atta Chakki', mode: 'auto' };
var users = [];
var isLoggedIn = false;
var currentUser = null;

var currentDeliverOrderId = null;
var currentDeliverProduct = null;

// ================== FIREBASE SYNC ==================
function loadAllData(callback) {
  if (!firebaseReady) { if (callback) callback(); return; }
  var pending = 5;
  function done() { pending--; if (pending === 0 && callback) callback(); }

  db.collection('shopkeepers').get().then(function(snap) {
    shopkeepers = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; shopkeepers.push(d); });
    done();
  }).catch(function(e) { console.log(e); done(); });

  db.collection('orders').get().then(function(snap) {
    orders = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; orders.push(d); });
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
      if (d.mode) settings.mode = d.mode;
    }
    done();
  }).catch(function(e) { done(); });

  db.collection('users').get().then(function(snap) {
    users = [];
    snap.forEach(function(doc) { var d = doc.data(); d.id = doc.id; users.push(d); });
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
  saveToFirebase('settings', 'business', { bizName: settings.bizName, mode: settings.mode });
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
  if (pass !== pass2) { err.textContent = 'Password match nahi kar rahe'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua. Page refresh karein.'; return; }

  err.textContent = 'Account bana rahe hain...';

  db.collection('users').where('user', '==', user).get().then(function(snap) {
    if (!snap.empty) {
      err.textContent = 'Ye username pehle se mojood hai';
      return;
    }
    var adminUser = {
      user: user,
      pass: pass,
      display: user,
      isAdmin: true,
      perms: { newOrder: true, deliver: true, shopkeepers: true, history: true, settings: true },
      createdAt: new Date().toISOString()
    };
    db.collection('users').add(adminUser).then(function(ref) {
      err.textContent = '';
      alert('Admin account ban gaya! Ab login karein.');
      hideSignup();
      document.getElementById('loginUser').value = user;
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
    }).catch(function(e) {
      console.log('Signup add error:', e);
      err.textContent = 'Error: ' + e.message;
    });
  }).catch(function(e) {
    console.log('Signup check error:', e);
    err.textContent = 'Error: ' + e.message;
  });
}

// ================== LOGIN ==================
function doLogin() {
  var user = document.getElementById('loginUser').value.trim();
  var pass = document.getElementById('loginPass').value;
  var err = document.getElementById('loginError');
  err.textContent = '';

  if (!user || !pass) { err.textContent = 'Username aur password daalein'; return; }
  if (!firebaseReady) { err.textContent = 'Firebase load nahi hua. Refresh karein.'; return; }

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
  }).catch(function(e) {
    console.log('Login error:', e);
    err.textContent = 'Error: ' + e.message;
  });
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
  document.getElementById('appWrapper').style.display = 'block';
  renderSidebarNav();
  applySettings();
  renderDashboard();
  renderShopkeepers();
  prepareOrderForm();
  renderHistory();
  renderSettings();
  if (isAdmin()) renderUsers();
}

// ================== SIDEBAR ==================
function renderSidebarNav() {
  var nav = document.getElementById('sidebarNav');
  var html = '';
  html += '<button class="nav-btn active" onclick="showPage(\'dashboard\', this)"><i class="fa fa-home"></i> <span>Dashboard</span></button>';
  if (can('newOrder')) html += '<button class="nav-btn" onclick="showPage(\'neworder\', this)"><i class="fa fa-plus-circle"></i> <span>Naya Order</span></button>';
  html += '<button class="nav-btn" onclick="showPage(\'orders\', this)"><i class="fa fa-truck"></i> <span>Orders / Loading</span></button>';
  if (can('shopkeepers')) html += '<button class="nav-btn" onclick="showPage(\'shopkeepers\', this)"><i class="fa fa-users"></i> <span>Shopkeepers</span></button>';
  html += '<button class="nav-btn" onclick="showPage(\'delivery\', this)"><i class="fa fa-check-circle"></i> <span>Delivery</span></button>';
  if (can('history')) html += '<button class="nav-btn" onclick="showPage(\'history\', this)"><i class="fa fa-clock"></i> <span>History</span></button>';
  if (isAdmin()) html += '<button class="nav-btn" onclick="showPage(\'users\', this)"><i class="fa fa-user-shield"></i> <span>Users</span></button>';
  if (can('settings')) html += '<button class="nav-btn" onclick="showPage(\'settings\', this)"><i class="fa fa-gear"></i> <span>Settings</span></button>';
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
  var totalMaund = 0;
  var kgList = [];
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
  return parts.join(' ');
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
    var remM = m - dm;
    var remK = k - dk;
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

  var pages = document.querySelectorAll('.page');
  for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
  var target = document.getElementById(pageId);
  if (target) target.classList.add('active');

  var navBtns = document.querySelectorAll('.nav-btn');
  for (var j = 0; j < navBtns.length; j++) navBtns[j].classList.remove('active');
  if (btn) btn.classList.add('active');

  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.remove('open');

  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'shopkeepers') renderShopkeepers();
  if (pageId === 'neworder') prepareOrderForm();
  if (pageId === 'orders') {
    var dEl = document.getElementById('ordersDate');
    if (dEl && !dEl.value) dEl.value = todayStr();
    renderOrdersPage();
  }
  if (pageId === 'delivery') renderDelivery();
  if (pageId === 'history') renderHistory();
  if (pageId === 'settings') renderSettings();
  if (pageId === 'users') renderUsers();
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
  body.classList.remove('mobile-mode', 'pc-mode');
  if (settings.mode === 'mobile') body.classList.add('mobile-mode');
  else if (settings.mode === 'pc') body.classList.add('pc-mode');
  else {
    if (window.innerWidth < 768) body.classList.add('mobile-mode');
    else body.classList.add('pc-mode');
  }
}
function setMode(m) {
  settings.mode = m;
  saveSettingsFirebase();
  applySettings();
  renderSettings();
  alert('Mode: ' + (m === 'mobile' ? 'Mobile' : 'PC'));
}
function toggleMode() {
  settings.mode = settings.mode === 'mobile' ? 'pc' : 'mobile';
  saveSettingsFirebase();
  applySettings();
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
  var pcBtn = document.getElementById('modePC');
  var mobBtn = document.getElementById('modeMobile');
  if (pcBtn) pcBtn.classList.toggle('active', settings.mode === 'pc');
  if (mobBtn) mobBtn.classList.toggle('active', settings.mode === 'mobile');
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
  prepareOrderForm();
}
function deleteProduct(i) {
  if (!confirm('Delete: ' + products[i] + '?')) return;
  products.splice(i, 1);
  saveSettingsFirebase();
  renderProductsList();
  prepareOrderForm();
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
    if (users[i].user === user && users[i].id != id) {
      alert('Ye username pehle se mojood hai'); return;
    }
  }
  var perms = {
    newOrder: document.getElementById('permNewOrder').checked,
    deliver: document.getElementById('permDeliver').checked,
    shopkeepers: document.getElementById('permShopkeepers').checked,
    history: document.getElementById('permHistory').checked,
    settings: document.getElementById('permSettings').checked
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
    user: user, pass: pass, display: display || user,
    isAdmin: false, perms: perms, createdAt: new Date().toISOString()
  };
  if (firebaseReady) {
    db.collection('users').add(newUser).then(function(ref) {
      newUser.id = ref.id;
      users.push(newUser);
      alert('User save ho gaya!');
      resetUserForm(); renderUsers();
    }).catch(function(e) { alert('Error: ' + e.message); });
  } else {
    alert('Internet issue.');
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
  if (users.length === 0) {
    list.innerHTML = '<div class="empty"><i class="fa fa-users"></i>Koi user nahi.</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    var badge = u.isAdmin ? '<span class="badge admin-badge">ADMIN</span>' : '<span class="badge staff-badge">STAFF</span>';
    var chips = '';
    var permsList = [
      { k: 'newOrder', label: 'Naya Order' },
      { k: 'deliver', label: 'Deliver' },
      { k: 'shopkeepers', label: 'Shopkeepers' },
      { k: 'history', label: 'History' },
      { k: 'settings', label: 'Settings' }
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
    html += '<div class="item user-item">' +
      '<div class="item-info">' +
        '<h4><i class="fa fa-user-circle"></i> ' + (u.display || u.user) + '</h4>' +
        '<p><b>@' + u.user + '</b></p>' + badge +
        '<div class="perm-chips">' + chips + '</div>' +
      '</div>' +
      '<div class="item-actions">' + actions + '</div>' +
    '</div>';
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
      rows += '<div class="shop-order-line">' +
        '<span class="product-name">📦 ' + keys[k] + '</span>' +
        '<span class="qty">' + productQtySummary(byProduct[keys[k]]) + '</span>' +
      '</div>';
    }
    list.innerHTML = rows || '<div class="empty">Sab deliver ho gaya!</div>';
  }

  // === Today's Pending Shopkeeper Order list ===
  renderPendingShopkeeperList();
}

// ================== TODAY'S PENDING SHOPKEEPER LIST ==================
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
      '<span><span class="order-count">' + count + '</span><i class="fa fa-chevron-right arrow-icon"></i></span>' +
    '</div>';
  }
  list.innerHTML = html;
}

// ================== PENDING SHOP MODAL ==================
function openPendingShopModal(shopId) {
  var today = todayStr();
  var shopName = 'Unknown', shopMobile = '';
  for (var i = 0; i < shopkeepers.length; i++) {
    if (shopkeepers[i].id == shopId) {
      shopName = shopkeepers[i].name;
      shopMobile = shopkeepers[i].mobile;
    }
  }
  document.getElementById('pendingShopTitle').textContent = shopName + ' - Aaj Ke Orders';
  document.getElementById('pendingShopModal').setAttribute('data-shop-id', shopId);

  var sOrders = [];
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == shopId && o.date === today &&
        (o.status === 'Pending' || o.status === 'Partial')) {
      sOrders.push(o);
    }
  }

  var body = document.getElementById('pendingShopBody');
  if (sOrders.length === 0) {
    body.innerHTML = '<div class="empty">Koi pending order nahi.</div>';
  } else {
    var html = '';
    for (var i = 0; i < sOrders.length; i++) {
      var o = sOrders[i];
      var linesHtml = '';
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
        linesHtml += '<div class="product-line">' +
          '<div class="product-line-info">' +
            '<span class="p-name">📦 ' + it.product + '</span>' +
            '<span class="p-qty">' + qtyText(remM, remK) + '</span>' +
            deliveredText +
          '</div>' + action +
        '</div>';
      }
      if (linesHtml === '') continue;

      var totalKg = 0;
      for (var j = 0; j < o.items.length; j++) {
        var it = o.items[j];
        var remM = (parseInt(it.maund) || 0) - (parseInt(it.deliveredMaund) || 0);
        var remK = (parseInt(it.kg) || 0) - (parseInt(it.deliveredKg) || 0);
        totalKg += (remM * 40) + remK;
      }

      html += '<div class="shop-group">' +
        '<div class="shop-group-head">' +
          '<div><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
            '<p><i class="fa fa-phone"></i> ' + shopMobile + ' • ' + formatDate(o.date) + '</p></div>' +
          '<span class="shop-group-total">' + totalKgText(totalKg) + '</span>' +
        '</div>' + linesHtml +
      '</div>';
    }
    body.innerHTML = html || '<div class="empty">Koi pending order nahi.</div>';
  }

  document.getElementById('pendingShopModal').classList.add('active');
}

function closePendingShopModal() {
  document.getElementById('pendingShopModal').classList.remove('active');
  document.getElementById('pendingShopModal').removeAttribute('data-shop-id');
}

// Pending shop modal ko refresh karo bina band kiye
function refreshPendingShopModal() {
  var modal = document.getElementById('pendingShopModal');
  if (!modal) return;
  var currentShopId = modal.getAttribute('data-shop-id');
  if (!currentShopId) { closePendingShopModal(); return; }

  // Check karo kya is shop ka koi pending order baqi hai
  var today = todayStr();
  var stillPending = false;
  for (var i = 0; i < orders.length; i++) {
    var o = orders[i];
    if (o.shopId == currentShopId && o.date === today &&
        (o.status === 'Pending' || o.status === 'Partial')) {
      stillPending = true;
      break;
    }
  }

  if (!stillPending) {
    // Saare orders deliver ho gaye — modal band karo
    closePendingShopModal();
  } else {
    // Warna modal ko dobara render karo (same shop ke liye)
    openPendingShopModal(currentShopId);
  }
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
    resetShopForm(); renderShopkeepers(); renderDashboard();
    alert('Shopkeeper save!'); return;
  }

  var newShop = { name: name, mobile: mobile, address: address, createdAt: new Date().toISOString() };
  if (firebaseReady) {
    db.collection('shopkeepers').add(newShop).then(function(ref) {
      newShop.id = ref.id;
      shopkeepers.push(newShop);
      resetShopForm(); renderShopkeepers(); renderDashboard();
      alert('Shopkeeper save!');
    }).catch(function(e) { alert('Error: ' + e.message); });
  } else {
    alert('Internet issue.');
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
  renderShopkeepers(); renderDashboard();
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
    html += '<div class="item">' +
      '<div class="item-info">' +
        '<h4><i class="fa fa-store"></i> ' + s.name + '</h4>' +
        '<p><i class="fa fa-phone"></i> ' + s.mobile + '</p>' +
        (s.address ? '<p><i class="fa fa-map-marker-alt"></i> ' + s.address + '</p>' : '') +
        '<p><small>' + total + ' total • ' + pending + ' pending</small></p>' +
      '</div>' +
      '<div class="item-actions">' +
        '<button class="btn small" onclick="viewShopHistory(\'' + s.id + '\')"><i class="fa fa-history"></i> History</button>' +
        editBtns +
      '</div>' +
    '</div>';
  }
  list.innerHTML = html;
  if (!can('shopkeepers')) {
    var form = document.getElementById('shopkeeperFormBox');
    if (form) form.style.display = 'none';
  }
}

// ================== NEW ORDER ==================
function prepareOrderForm() {
  var select = document.getElementById('orderShop');
  if (!select) return;
  if (shopkeepers.length === 0) {
    select.innerHTML = '<option value="">Pehle shopkeeper add karein</option>';
  } else {
    var html = '<option value="">-- Shopkeeper --</option>';
    for (var i = 0; i < shopkeepers.length; i++) {
      html += '<option value="' + shopkeepers[i].id + '">' + shopkeepers[i].name + ' (' + shopkeepers[i].mobile + ')</option>';
    }
    select.innerHTML = html;
  }
  var dEl = document.getElementById('orderDate');
  if (dEl) dEl.value = todayStr();
  var rows = document.getElementById('productRows');
  if (rows) { rows.innerHTML = ''; addProductRow(); }
  updateSummary();
}
function addProductRow() {
  var container = document.getElementById('productRows');
  if (!container) return;
  var idx = container.children.length;
  if (products.length === 0) { alert('Pehle Settings mein product add karein'); return; }
  var div = document.createElement('div');
  div.className = 'product-row';
  var productsHtml = '';
  for (var i = 0; i < products.length; i++) {
    productsHtml += '<option value="' + products[i] + '">' + products[i] + '</option>';
  }
  var removeBtn = idx > 0 ? '<button class="remove-btn" onclick="removeProductRow(this)"><i class="fa fa-trash"></i></button>' : '';
  div.innerHTML = '<div class="product-row-head">' +
      '<h4><i class="fa fa-box"></i> Product #' + (idx + 1) + '</h4>' + removeBtn +
    '</div>' +
    '<div class="form-group"><label>Product</label><select class="prod-select" onchange="updateSummary()">' + productsHtml + '</select></div>' +
    '<div class="qty-row">' +
      '<div class="form-group"><label>Maund</label><input type="number" class="maund-input" min="0" placeholder="0" oninput="updateSummary()" /></div>' +
      '<div class="form-group"><label>Kg</label><input type="number" class="kg-input" min="0" max="39" placeholder="0" oninput="updateSummary()" /></div>' +
      '<div class="form-group"><label>Total</label><input type="text" class="total-input" readonly /></div>' +
    '</div>';
  container.appendChild(div);
  updateSummary();
}
function removeProductRow(btn) {
  btn.parentNode.parentNode.remove();
  var rows = document.querySelectorAll('.product-row');
  for (var i = 0; i < rows.length; i++) {
    rows[i].querySelector('h4').innerHTML = '<i class="fa fa-box"></i> Product #' + (i + 1);
  }
  updateSummary();
}
function updateSummary() {
  var rows = document.querySelectorAll('.product-row');
  var totalKg = 0, lines = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var prod = row.querySelector('.prod-select').value;
    var m = parseInt(row.querySelector('.maund-input').value) || 0;
    var k = parseInt(row.querySelector('.kg-input').value) || 0;
    var rowKg = m * 40 + k;
    row.querySelector('.total-input').value = qtyText(m, k);
    if (rowKg > 0) { totalKg += rowKg; lines.push({ product: prod, maund: m, kg: k }); }
  }
  var summary = document.getElementById('orderSummary');
  if (!summary) return;
  if (lines.length === 0) {
    summary.innerHTML = '<h4>Order Summary</h4><p style="color:#64748b;font-size:14px">Abhi koi quantity nahi daali</p>';
    return;
  }
  var html = '<h4>Order Summary</h4>';
  for (var i = 0; i < lines.length; i++) {
    html += '<div class="summary-line"><span>' + lines[i].product + '</span><span>' + qtyText(lines[i].maund, lines[i].kg) + '</span></div>';
  }
  html += '<div class="summary-line"><span>TOTAL</span><span>' + totalKgText(totalKg) + '</span></div>';
  summary.innerHTML = html;
}
function saveMultiOrder() {
  if (!can('newOrder')) { alert('Permission nahi hai'); return; }
  var shopId = document.getElementById('orderShop').value;
  var date = document.getElementById('orderDate').value;
  var notes = document.getElementById('orderNotes').value.trim();
  if (!shopId) { alert('Shopkeeper chunein!'); return; }
  if (!date) { alert('Date chunein!'); return; }
  var rows = document.querySelectorAll('.product-row');
  var items = [], totalKg = 0;
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var prod = row.querySelector('.prod-select').value;
    var m = parseInt(row.querySelector('.maund-input').value) || 0;
    var k = parseInt(row.querySelector('.kg-input').value) || 0;
    var rowKg = m * 40 + k;
    if (rowKg > 0) {
      items.push({ product: prod, maund: m, kg: k, deliveredMaund: 0, deliveredKg: 0, totalKg: rowKg });
      totalKg += rowKg;
    }
  }
  if (items.length === 0) { alert('Kam az kam ek product ki quantity daalein!'); return; }
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
      var shopName = '';
      for (var i = 0; i < shopkeepers.length; i++) {
        if (shopkeepers[i].id == shopId) shopName = shopkeepers[i].name;
      }
      alert('Order save!\n' + shopName + '\n' + items.length + ' products');
      prepareOrderForm();
      document.getElementById('orderNotes').value = '';
    }).catch(function(e) { alert('Error: ' + e.message); });
  } else {
    alert('Internet issue.');
  }
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
        linesHtml += '<div class="product-line">' +
          '<div class="product-line-info">' +
            '<span class="p-name">📦 ' + it.product + '</span>' +
            '<span class="p-qty">' + qtyText(remM, remK) + '</span>' +
            deliveredText +
          '</div>' + action +
        '</div>';
      }
    }
    html += '<div class="shop-group">' +
      '<div class="shop-group-head">' +
        '<div>' +
          '<h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
          '<p><i class="fa fa-map-marker-alt"></i> ' + shopAddress + ' • <i class="fa fa-phone"></i> ' + shopMobile + '</p>' +
        '</div>' +
        '<span class="shop-group-total">' + totalKgText(shopKg) + '</span>' +
      '</div>' +
      linesHtml +
    '</div>';
  }
  list.innerHTML = html;
}

// ================== DELIVER MODAL ==================
function openDeliverModal(orderId, product) {
  if (!can('deliver')) { alert('Permission nahi hai'); return; }
  currentDeliverOrderId = orderId;
  currentDeliverProduct = product;
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
    var totalText = qtyText(p.maund, p.kg);
    html += '<div class="deliver-row">' +
      '<div class="deliver-row-head">Baqi: ' + totalText + '</div>' +
      '<div class="deliver-row-sub">Kitna deliver? (khaali chhoro to poora)</div>' +
      '<div class="deliver-qty-row">' +
        '<div class="form-group"><label>Maund</label>' +
          '<input type="number" class="deliver-maund" min="0" max="' + p.maund + '" placeholder="' + p.maund + '" data-idx="' + p.index + '" />' +
        '</div>' +
        '<div class="form-group"><label>Kg</label>' +
          '<input type="number" class="deliver-kg" min="0" max="' + p.kg + '" placeholder="' + p.kg + '" data-idx="' + p.index + '" />' +
        '</div>' +
      '</div>' +
    '</div>';
  }
  body.innerHTML = html;
  document.getElementById('deliverModal').classList.add('active');
}
function closeDeliverModal() {
  document.getElementById('deliverModal').classList.remove('active');
  currentDeliverOrderId = null;
  currentDeliverProduct = null;
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
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();

  // Refresh pending shop modal (WITHOUT closing it) — taake user baar baar tap na kare
  var pm = document.getElementById('pendingShopModal');
  if (pm && pm.classList.contains('active')) {
    refreshPendingShopModal();
  }

  alert('Deliver ho gaya!');
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
  renderOrdersPage(); renderDashboard(); renderDelivery(); renderHistory();

  // Refresh pending shop modal (WITHOUT closing it)
  var pm = document.getElementById('pendingShopModal');
  if (pm && pm.classList.contains('active')) {
    refreshPendingShopModal();
  }

  alert('Poora deliver ho gaya!');
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
      if (shopkeepers[i].id == shopId) {
        shopName = shopkeepers[i].name;
        shopMobile = shopkeepers[i].mobile;
      }
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
        linesHtml += '<div class="product-line">' +
          '<div class="product-line-info">' +
            '<span class="p-name">📦 ' + it.product + '</span>' +
            '<span class="p-qty">' + qtyText(remM, remK) + '</span>' +
            deliveredText +
          '</div>' + action +
        '</div>';
      }
    }
    html += '<div class="shop-group">' +
      '<div class="shop-group-head">' +
        '<div><h4><i class="fa fa-store"></i> ' + shopName + '</h4>' +
          '<p><i class="fa fa-phone"></i> ' + shopMobile + '</p></div>' +
        '<span class="shop-group-total">' + totalKgText(totalKg) + '</span>' +
      '</div>' + linesHtml +
    '</div>';
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
    html += '<div class="item delivered-item">' +
      '<div class="item-info">' +
        '<h4>' + shopName + '</h4>' + itemsHtml +
        '<p class="date-line"><i class="fa fa-calendar"></i> ' + formatDate(o.date) + '</p>' +
        '<span class="badge delivered">Delivered</span>' +
      '</div>' +
    '</div>';
  }
  list.innerHTML = html;
}
function clearHistoryFilter() {
  document.getElementById('historySearch').value = '';
  document.getElementById('historyDate').value = '';
  renderHistory();
}

// ================== MODAL ==================
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
          '<span class="badge ' + st + '">' + o.status + '</span>' +
        '</div>' +
      '</div>';
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
      var loggedIn = localStorage.getItem('isLoggedIn') === 'true';
      var cachedUser = JSON.parse(localStorage.getItem('currentUser'));
      if (loggedIn && cachedUser) {
        var stillExists = false;
        for (var i = 0; i < users.length; i++) {
          if (users[i].id === cachedUser.id) {
            stillExists = true;
            currentUser = users[i];
            break;
          }
        }
        if (stillExists) {
          isLoggedIn = true;
          showApp();
          return;
        }
      }
      isLoggedIn = false;
      localStorage.setItem('isLoggedIn', 'false');
      localStorage.removeItem('currentUser');
      document.getElementById('loginScreen').style.display = 'flex';
      document.getElementById('appWrapper').style.display = 'none';
    });
  });
});
