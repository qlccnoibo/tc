// ==================== GOOGLE SHEETS CONFIG ====================
var GOOGLE_SHEETS_API = 'https://script.google.com/macros/s/AKfycbway2n_xK91Ef40-eu5qkTiStil48aR9LjSx_L8J_CGOhK_d1duj7EHsqKFoRuS7pvJ6A/exec';
var USE_GOOGLE_SHEETS = false;
// ==================== GITHUB CONFIG ====================
var GITHUB_TOKEN = '';
var GITHUB_REPO_OWNER = 'qlccnoibo';
var GITHUB_REPO_NAME = 'cc';
var GITHUB_FILE_PATH = 'hidden_emps.json';
var USE_GITHUB_SYNC = true;

// ==================== PHÂN QUYỀN ====================
var ADMIN_PASSWORD = 'Admin@123';
var isAdmin = false;

// ==================== STORAGE KEYS ====================
var EMP_KEY = 'e';
var SHIFT_KEY = 's';
var GROUP_KEY = 'g';
var AUDIT_KEY = 'a';
var REC_KEY = 'r';

// ==================== DEFAULT DATA ====================
var D_SHIFTS = [
  { id: 's1', name: 'Ca 1', time: '7h-15h', icon: '🌅' },
  { id: 's2', name: 'Ca 2', time: '15h-23h', icon: '🌇' },
  { id: 's3', name: 'Ca 3', time: '23h-7h', icon: '🌙' },
  { id: 's4', name: '1/2 Ca', time: 'Bán TG', icon: '⏱️' },
  { id: 's5', name: 'HC', time: 'Giờ HC', icon: '🏢' },
  { id: 's6', name: 'Nghỉ', time: 'Off', icon: '🛌' }
];

var D_GROUPS = [
  { id: 'g1', title: 'Nhóm 1 - Chuẩn bị & SX', color: '#3b82f6', items: [{ id: 't1', name: 'Chuẩn bị NL' }, { id: 't2', name: 'Sản xuất' }] },
  { id: 'g2', title: 'Nhóm 2 - Đóng gói & QC', color: '#10b981', items: [{ id: 't3', name: 'Đóng gói' }, { id: 't4', name: 'Kiểm tra CL' }] },
  { id: 'g3', title: 'Nhóm 3 - Vận chuyển', color: '#f59e0b', items: [{ id: 't5', name: 'Vận chuyển' }] },
  { id: 'g4', title: 'Nhóm 4 - Bảo trì & VS', color: '#8b5cf6', items: [{ id: 't6', name: 'Bảo trì' }, { id: 't7', name: 'Dọn vệ sinh' }] },
  { id: 'g5', title: 'Nhóm 5 - Kho & HT', color: '#ec4899', items: [{ id: 't8', name: 'Quản lý kho' }, { id: 't9', name: 'Hỗ trợ KT' }] }
];

// ==================== GLOBAL STATE ====================
var emp = L(EMP_KEY, [{ id: 'e1', name: 'Nguyễn Văn A' }, { id: 'e2', name: 'Trần Thị B' }]);
var shifts = L(SHIFT_KEY, D_SHIFTS);
var groups = L(GROUP_KEY, D_GROUPS);
var expanded = {};
var selFile = null;
var selectedEmployees = [];
var statsFilterState = { period: 'all', fromDate: '', toDate: '', employee: '', shift: '', task: '' };
var heatmapState = { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
var heatmapRange = { start: null, end: null };
var _tableGroupIndex = 0;
var _tableGroupMap = {};
var _editModalData = {
  key: null, employees: [], shiftIndex: 0, tasks: [],
  eat: 'Có', note: '', originalDate: '', originalShift: '',
  originalEat: '', originalNote: '', originalTasks: [], originalEmployees: [],
  originalIds: []
};

// ==================== PAGINATION ====================
var PaginationManager = {
  overview: { currentPage: 1, itemsPerPage: 30, data: [], containerId: 'statsTableContainer' },
  taskDetail: { currentPage: 1, itemsPerPage: 30, data: [], containerId: 'taskDetailTable' }
};

// ==================== UTILITY FUNCTIONS ====================
function L(k, f) {
  try {
    var r = localStorage.getItem(k);
    return r ? JSON.parse(r) : JSON.parse(JSON.stringify(f));
  } catch (e) {
    return JSON.parse(JSON.stringify(f));
  }
}

async function S(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  if (USE_GOOGLE_SHEETS) {
    try {
      var sheetMap = { 'e': 'employees', 's': 'shifts', 'g': 'groups', 'r': 'records', 'a': 'audit' };
      var sheetName = sheetMap[key] || key;
      if (key === 'e' || key === 's' || key === 'g') {
        var allRows = [];
        for (var i = 0; i < value.length; i++) {
          var row = [];
          if (key === 'e') row = [value[i].id || '', value[i].name || '', value[i].group || 'Chưa phân nhóm'];
          else if (key === 's') row = [value[i].id || '', value[i].name || '', value[i].time || '', value[i].icon || ''];
          else if (key === 'g') row = [value[i].id || '', value[i].title || '', value[i].color || '', JSON.stringify(value[i].items || [])];
          allRows.push(row);
        }
        var url = GOOGLE_SHEETS_API + '?action=writeAll&sheet=' + encodeURIComponent(sheetName);
        var response = await fetch(url, { method: 'POST', body: JSON.stringify(allRows) });
        var result = await response.json();
        console.log('✅ Đồng bộ ' + sheetName + ': ' + (result.count || allRows.length) + ' dòng');
      }
    } catch (e) {
      console.error('Lỗi save:', e);
    }
  }
}

// Hàm định dạng số
function formatNumber(n) {
    return Number(n).toLocaleString('vi-VN');
}

function log(m) {
  var l = L(AUDIT_KEY, []);
  l.unshift({ time: new Date().toISOString(), msg: m });
  if (l.length > 200) l.length = 200;
  S(AUDIT_KEY, l);
  renderAudit();
}

function cleanEmployeeName(name) {
  if (!name) return '';
  return name.replace(/\s*\([^)]*\)/g, '').trim();
}

function removeAccents(str) {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function containsExactChars(name, query) {
  if (!query || !name) return false;
  if (query.length > name.length) return false;
  var nl = name.toLowerCase(),
    ql = query.toLowerCase(),
    nna = removeAccents(nl),
    qna = removeAccents(ql);
  return nl.indexOf(ql) !== -1 || nna.indexOf(qna) !== -1;
}

function isEmployeeSelected(empName) {
  return selectedEmployees.includes(empName);
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  var parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function getShiftHours(shiftStr) {
  if (!shiftStr) return 0;
  var name = shiftStr.split('(')[0].trim().toLowerCase();
  if (name.includes('ca 1') || name.includes('ca 2') || name.includes('ca 3') || name.includes('hc') || name.includes('hành chính')) return 8;
  if (name.includes('1/2') || name.includes('bán tg')) return 4;
  if (name.includes('nghỉ') || name.includes('off')) return 0;
  var match = shiftStr.match(/(\d+)h\s*-\s*(\d+)h/i);
  if (match) {
    var start = parseInt(match[1]),
      end = parseInt(match[2]);
    if (!isNaN(start) && !isNaN(end)) return end > start ? end - start : (24 - start + end);
  }
  return 8;
}

function getShiftColorClass(shiftName) {
  if (!shiftName) return 'khac';
  var s = shiftName.toLowerCase();
  if (s.includes('ca 1')) return 'ca1';
  if (s.includes('ca 2')) return 'ca2';
  if (s.includes('ca 3')) return 'ca3';
  if (s.includes('hc') || s.includes('hành chính')) return 'hc';
  if (s.includes('nghỉ') || s.includes('off')) return 'nghi';
  if (s.includes('1/2') || s.includes('bán')) return 'banca';
  return 'khac';
}

function getShiftOrder(shiftName) {
  if (!shiftName) return 99;
  var s = shiftName.toLowerCase();
  if (s.includes('ca 1')) return 1;
  if (s.includes('ca 2')) return 2;
  if (s.includes('ca 3')) return 3;
  if (s.includes('hc') || s.includes('hành chính')) return 4;
  if (s.includes('1/2') || s.includes('bán')) return 5;
  if (s.includes('nghỉ') || s.includes('off')) return 6;
  return 99;
}

function highlightTruongCa(tasksStr) {
  if (!tasksStr) return '-';
  var tasks = tasksStr.split(', ');
  var result = tasks.map(function(t) {
    if (t.indexOf('Trưởng ca') > -1) {
      return '<span style="background:#dc2626; color:white; padding:2px 8px; border-radius:12px; font-weight:700; font-size:12px;">' + escHtml(t) + '</span>';
    }
    return escHtml(t);
  });
  return result.join(', ');
}

function getVisibleEmployees() {
  if (isAdmin) return emp;
  var hiddenEmps = getHiddenEmployees();
  return emp.filter(function(e) { return hiddenEmps.indexOf(e.id) === -1; });
}

function getHiddenEmployees() {
  try {
    return JSON.parse(localStorage.getItem('hidden_emps') || '[]');
  } catch (e) {
    return [];
  }
}

function isEmployeeHidden(empId) {
  var hiddenEmps = getHiddenEmployees();
  return hiddenEmps.indexOf(empId) > -1;
}

// ==================== DIALOG FUNCTIONS ====================
(function() {
  var bd = document.getElementById('__customDialogBackdrop'),
    tE = document.getElementById('__cdTitle'),
    bE = document.getElementById('__cdBody'),
    cE = document.getElementById('__cdControls'),
    iW = document.getElementById('__cdInputWrap'),
    iE = document.getElementById('__cdInput');

  function c() {
    bd.classList.remove('show');
    cE.innerHTML = '';
    iW.style.display = 'none';
    iE.value = '';
    iE.type = 'text';
  }

  window.showAlert = function(m, t) {
    t = t || 'Thông báo';
    return new Promise(function(r) {
      tE.textContent = t;
      bE.textContent = m;
      cE.innerHTML = '';
      var o = document.createElement('button');
      o.className = 'btn btn-primary';
      o.textContent = 'OK';
      o.onclick = function() { c();
        r(); };
      cE.appendChild(o);
      bd.classList.add('show');
    });
  };

  window.showConfirm = function(m, t) {
    t = t || 'Xác nhận';
    return new Promise(function(r) {
      tE.textContent = t;
      bE.textContent = m;
      cE.innerHTML = '';
      var cn = document.createElement('button');
      cn.className = 'btn';
      cn.textContent = 'Hủy';
      cn.onclick = function() { c();
        r(false); };
      var o = document.createElement('button');
      o.className = 'btn btn-primary';
      o.textContent = 'Đồng ý';
      o.onclick = function() { c();
        r(true); };
      cE.appendChild(cn);
      cE.appendChild(o);
      bd.classList.add('show');
    });
  };

  window.showPrompt = function(m, d, t) {
    t = t || 'Nhập';
    d = d || '';
    return new Promise(function(r) {
      tE.textContent = t;
      bE.textContent = m;
      cE.innerHTML = '';
      iW.style.display = 'block';
      iE.value = d;
      iE.type = 'text';
      setTimeout(function() { iE.focus(); }, 100);
      var cn = document.createElement('button');
      cn.className = 'btn';
      cn.textContent = 'Hủy';
      cn.onclick = function() { c();
        r(null); };
      var o = document.createElement('button');
      o.className = 'btn btn-primary';
      o.textContent = 'Lưu';
      o.onclick = function() {
        var v = iE.value;
        c();
        r(v);
      };
      cE.appendChild(cn);
      cE.appendChild(o);
      bd.classList.add('show');
    });
  };

  window.showPassword = function(m, t) {
    t = t || 'Đăng nhập';
    return new Promise(function(r) {
      tE.textContent = t;
      bE.textContent = m;
      cE.innerHTML = '';
      iW.style.display = 'block';
      iE.type = 'password';
      iE.value = '';
      setTimeout(function() { iE.focus(); }, 100);
      var cn = document.createElement('button');
      cn.className = 'btn';
      cn.textContent = 'Hủy';
      cn.onclick = function() { c();
        r(null); };
      var o = document.createElement('button');
      o.className = 'btn btn-primary';
      o.textContent = 'Đăng nhập';
      o.onclick = function() {
        var v = iE.value;
        iE.type = 'text';
        c();
        r(v);
      };
      cE.appendChild(cn);
      cE.appendChild(o);
      bd.classList.add('show');
    });
  };

  bd.addEventListener('click', function(e) {
    if (e.target === bd) c();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && bd.classList.contains('show')) c();
    if (e.key === 'Enter' && bd.classList.contains('show')) {
      var saveBtn = cE.querySelector('.btn-primary');
      if (saveBtn) saveBtn.click();
    }
  });
})();

// ==================== ADMIN FUNCTIONS ====================
function checkAdmin() {
  var loggedIn = sessionStorage.getItem('admin_logged_in');
  if (loggedIn === 'true') {
    isAdmin = true;
    adminMode();
  } else {
    isAdmin = false;
    employeeMode();
  }
}

function adminMode() {
  isAdmin = true;
  emp = L(EMP_KEY, []);
  rEmp();
  var backupSec = document.getElementById('backupSection');
  if (backupSec) backupSec.style.display = '';
  var tabCC = document.getElementById('tabChamCong');
  var tabQL = document.getElementById('tabQuanLy');
  if (tabCC) tabCC.style.display = '';
  if (tabQL) tabQL.style.display = '';
  var btn = document.getElementById('adminLoginBtn');
  if (btn) { btn.textContent = '🔓 Admin';
    btn.style.background = '#10b981'; }
    if (typeof renderStatsTable === 'function') {
        var records = L(REC_KEY, []);
        renderStatsTable(records);
    }
    
    var btn = document.getElementById('adminLoginBtn');
    if (btn) { btn.textContent = '🔓 Admin'; btn.style.background = '#10b981'; }
}

function employeeMode() {
  isAdmin = false;
  var _hiddenEmps = JSON.parse(localStorage.getItem('hidden_emps') || '[]');
  emp = L(EMP_KEY, []);
  if (_hiddenEmps.length > 0) {
    emp = emp.filter(function(e) { return _hiddenEmps.indexOf(e.id) === -1; });
  }
  rEmp();
  document.querySelectorAll('.admin-only').forEach(function(el) {
    el.style.display = 'none';
  });
  var backupSec = document.getElementById('backupSection');
  if (backupSec) backupSec.remove();
  var adminBtns = document.getElementById('adminActionBtns');
  if (adminBtns) adminBtns.style.display = 'none';
  var tabCC = document.getElementById('tabChamCong');
  var tabQL = document.getElementById('tabQuanLy');
  if (tabCC) tabCC.style.display = 'none';
  if (tabQL) tabQL.style.display = 'none';
  var pageCC = document.getElementById('pageChamCong');
  var pageQL = document.getElementById('pageQuanLy');
  if (pageCC) pageCC.style.display = 'none';
  if (pageQL) pageQL.style.display = 'none';
  switchTab('ThongKe');
  var btn = document.getElementById('adminLoginBtn');
  if (btn) { btn.textContent = '🔐 Đăng nhập';
    btn.style.background = '#64748b'; }
}

async function toggleAdmin() {
  if (isAdmin) {
    sessionStorage.removeItem('admin_logged_in');
    employeeMode();
    showAlert('✅ Đã đăng xuất!');
  } else {
    var pass = await showPassword('🔐 Nhập mật khẩu Admin:', 'Đăng nhập');
    if (pass === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_logged_in', 'true');
      adminMode();
      showAlert('✅ Đăng nhập thành công!');
    } else if (pass !== null) {
      showAlert('❌ Sai mật khẩu!');
    }
  }
}

// ==================== EMPLOYEE HIDDEN FUNCTIONS ====================
async function saveHiddenEmployees(hiddenEmps) {
  localStorage.setItem('hidden_emps', JSON.stringify(hiddenEmps));
  if (USE_GITHUB_SYNC) {
    var success = await uploadHiddenEmpsToGithub(hiddenEmps);
    if (success) {
      console.log('⚡ Đã đồng bộ lên GitHub!');
      setTimeout(function() {
        loadHiddenEmployeesFast().then(function(result) {
          console.log('✅ Đã tải lại từ GitHub:', result.length, 'nhân viên');
          rEmp();
          refreshAllAutocompletes();
        });
      }, 2000);
    }
  }
}

async function loadHiddenEmployeesFast() {
  if (USE_GITHUB_SYNC) {
    try {
      var githubUrl = 'https://raw.githubusercontent.com/' +
        GITHUB_REPO_OWNER + '/' +
        GITHUB_REPO_NAME + '/main/' +
        GITHUB_FILE_PATH + '?t=' + Date.now();
      var response = await fetch(githubUrl, { cache: 'no-store' });
      if (response.ok) {
        var hiddenEmps = await response.json();
        localStorage.setItem('hidden_emps', JSON.stringify(hiddenEmps));
        console.log('⚡ Đã tải từ GitHub: ' + hiddenEmps.length + ' nhân viên ẩn (nhanh)');
        return hiddenEmps;
      }
    } catch (e) {
      console.log('⚠️ Không tải được từ GitHub');
    }
  }
  return getHiddenEmployees();
}

async function uploadHiddenEmpsToGithub(hiddenEmps) {
  if (!GITHUB_TOKEN || GITHUB_TOKEN.length === 0) {
    console.log('⚠️ Chưa có GitHub Token! Cần Admin nhập token.');
    showAlert(
      '⚠️ Chưa có GitHub Token!\n\n' +
      '👉 Vào Tab Quản lý → Nhập token để đồng bộ GitHub.',
      'Thiếu token'
    );
    return false;
  }
  if (!USE_GITHUB_SYNC || !GITHUB_TOKEN) return false;
  try {
    var content = JSON.stringify(hiddenEmps);
    var base64Content = btoa(unescape(encodeURIComponent(content)));
    var sha = '';
    var getUrl = 'https://api.github.com/repos/' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '/contents/' + GITHUB_FILE_PATH;
    var getResponse = await fetch(getUrl, {
      headers: {
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (getResponse.ok) {
      var fileData = await getResponse.json();
      sha = fileData.sha;
    }
    var putUrl = 'https://api.github.com/repos/' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '/contents/' + GITHUB_FILE_PATH;
    var putData = {
      message: 'Update hidden_emps.json - ' + new Date().toISOString(),
      content: base64Content
    };
    if (sha) putData.sha = sha;
    var putResponse = await fetch(putUrl, {
      method: 'PUT',
      headers: {
        'Authorization': 'token ' + GITHUB_TOKEN,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(putData)
    });
    if (putResponse.ok) {
      console.log('✅ Đã upload hidden_emps.json lên GitHub!');
      return true;
    } else {
      var errorData = await putResponse.json();
      console.error('❌ Lỗi upload GitHub:', errorData.message);
      return false;
    }
  } catch (e) {
    console.error('❌ Lỗi upload GitHub:', e);
    return false;
  }
}

// ==================== GITHUB TOKEN FUNCTIONS ====================
window.setGithubToken = async function() {
  var token = await showPassword('Nhập GitHub Token mới:', '🔐 Bảo mật Token');
  if (!token) {
    showAlert('❌ Đã hủy nhập token!', 'Thông báo');
    return;
  }
  if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
    showAlert('❌ Token không hợp lệ!\n\nToken phải bắt đầu bằng "ghp_" hoặc "github_pat_"', 'Lỗi');
    return;
  }
  GITHUB_TOKEN = token;
  localStorage.setItem('github_token', token);
  var testResult = await testGithubToken(token);
  if (testResult.success) {
    showAlert(
      '✅ Token hợp lệ!\n\n' +
      '👤 Tài khoản: ' + testResult.username + '\n' +
      '📦 Repo: ' + GITHUB_REPO_OWNER + '/' + GITHUB_REPO_NAME + '\n\n' +
      '🔒 Token đã được lưu an toàn trên máy của bạn.',
      'Thành công'
    );
  } else {
    showAlert(
      '⚠️ Token đã lưu nhưng không thể xác thực!\n\n' +
      'Lỗi: ' + testResult.error + '\n\n' +
      '👉 Vui lòng kiểm tra lại token hoặc quyền repo.',
      'Cảnh báo'
    );
  }
};

async function testGithubToken(token) {
  try {
    var response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (response.ok) {
      var userData = await response.json();
      return { success: true, username: userData.login };
    } else {
      var errorData = await response.json();
      return { success: false, error: errorData.message || 'HTTP ' + response.status };
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
}

window.clearGithubToken = async function() {
  var confirmed = await showConfirm('Bạn muốn xóa GitHub Token đã lưu?', 'Xác nhận');
  if (!confirmed) return;
  GITHUB_TOKEN = '';
  localStorage.removeItem('github_token');
  showAlert('✅ Đã xóa token!', 'Thành công');
};

window.checkGithubTokenStatus = function() {
  var savedToken = localStorage.getItem('github_token');
  if (savedToken && savedToken.length > 0) {
    showAlert(
      '🔐 Trạng thái GitHub Token:\n\n' +
      '✅ Đã có token (dài ' + savedToken.length + ' ký tự)\n' +
      '💾 Lưu trên máy này\n\n' +
      '👉 Dùng nút "Xóa token" nếu muốn gỡ bỏ.',
      'Token'
    );
  } else {
    showAlert(
      '🔐 Trạng thái GitHub Token:\n\n' +
      '❌ Chưa có token\n\n' +
      '👉 Bấm "Nhập token" để thêm mới.',
      'Token'
    );
  }
};

window.checkSyncStatus = async function() {
  var status = '📊 TRẠNG THÁI ĐỒNG BỘ NHÂN VIÊN ẨN:\n\n';
  var localHidden = getHiddenEmployees();
  status += '💾 LocalStorage: ' + localHidden.length + ' nhân viên ẩn\n';
  if (localHidden.length > 0) {
    status += '   IDs: ' + localHidden.join(', ') + '\n';
  }
  status += '\n';
  if (USE_GITHUB_SYNC) {
    try {
      var githubUrl = 'https://raw.githubusercontent.com/' +
        GITHUB_REPO_OWNER + '/' +
        GITHUB_REPO_NAME + '/main/' +
        GITHUB_FILE_PATH + '?t=' + Date.now();
      var response = await fetch(githubUrl);
      if (response.ok) {
        var githubData = await response.json();
        status += '⚡ GitHub: ' + githubData.length + ' nhân viên ẩn\n';
        if (githubData.length > 0) {
          status += '   IDs: ' + githubData.join(', ') + '\n';
        }
      } else {
        status += '⚡ GitHub: ❌ Không truy cập được (HTTP ' + response.status + ')\n';
      }
    } catch (e) {
      status += '⚡ GitHub: ❌ Lỗi kết nối\n';
    }
  } else {
    status += '⚡ GitHub: Đã tắt\n';
  }
  status += '\n\n💡 Mẹo: Dữ liệu nên giống nhau ở LocalStorage và GitHub!';
  await showAlert(status, 'Trạng thái đồng bộ');
};

// ==================== SELECTED EMPLOYEES FUNCTIONS ====================
function addSelectedEmployee(empName) {
  if (isEmployeeSelected(empName)) {
    showAlert('Nhân viên "' + empName + '" đã được chọn!');
    return;
  }
  selectedEmployees.push(empName);
  renderSelectedEmployees();
  var empInput = document.getElementById('employeeInput');
  if (empInput) { empInput.value = '';
    empInput.focus(); }
  var empAutocomplete = document.getElementById('empAutocomplete');
  if (empAutocomplete) { empAutocomplete.innerHTML = '';
    empAutocomplete.style.display = 'none'; }
}

function removeSelectedEmployee(empName) {
  selectedEmployees = selectedEmployees.filter(function(n) { return n !== empName; });
  renderSelectedEmployees();
}

function renderSelectedEmployees() {
    var container = document.getElementById('selectedEmployees');
    if (!container) return;
    
    var html = '';
    selectedEmployees.forEach(function(empName, idx) {
        html += '<div class="selected-employee-item" draggable="true" ' +
                'data-index="' + idx + '" ' +
                'ondragstart="onDragStart(event)" ' +
                'ondragover="onDragOver(event)" ' +
                'ondrop="onDrop(event)" ' +
                'style="display:flex; align-items:center; gap:6px; padding:6px 10px; background:#f8fafc; border-radius:8px; margin-bottom:6px; border:1px solid #e5e7eb;">';
        html += '<span style="flex:1; display:flex; align-items:center;">' + 
        '<span style="display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; background:#2563eb; color:white; border-radius:50%; font-size:11px; font-weight:600; margin-right:8px; flex-shrink:0;">' + (idx + 1) + '</span>' + 
        cleanEmployeeName(empName) + 
        '</span>';
        html += '<span style="cursor:pointer;font-weight:700;color:#dc2626;font-size:14px;">✕</span>';
        html += '</div>';
    });
    
    container.innerHTML = html;
    
    var countEl = document.getElementById('selectedCount');
    if (countEl) countEl.textContent = '(' + selectedEmployees.length + ' đã chọn)';
}

window.onDragStart = function(e) {
    e.dataTransfer.setData('text/plain', e.target.dataset.index);
    e.target.classList.add('dragging');
};

window.onDragOver = function(e) {
    e.preventDefault();
};

window.onDrop = function(e) {
    e.preventDefault();
    var fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
    var toIdx = parseInt(e.target.dataset.index);
    
    if (fromIdx === toIdx) return;
    
    // Di chuyển phần tử trong mảng
    var item = selectedEmployees.splice(fromIdx, 1)[0];
    selectedEmployees.splice(toIdx, 0, item);
    
    renderSelectedEmployees();
};


// ==================== AUTOCOMPLETE FUNCTIONS ====================
function initAutocomplete() {
  var empInput = document.getElementById('employeeInput'),
    empAutocomplete = document.getElementById('empAutocomplete');
  if (!empInput || !empAutocomplete) return;
  empInput.addEventListener('input', function() {
    var val = this.value;
    empAutocomplete.innerHTML = '';
    if (!val) {
      empAutocomplete.style.display = 'none';
      return;
    }
    var matches = [];
    var visibleEmp = getVisibleEmployees();
    visibleEmp.forEach(function(e) {
      if (!isEmployeeSelected(e.name) && containsExactChars(e.name, val)) {
        var nameLower = removeAccents(e.name).toLowerCase(),
          queryLower = removeAccents(val).toLowerCase();
        matches.push({ employee: e, matchIndex: nameLower.indexOf(queryLower) >= 0 ? nameLower.indexOf(queryLower) : 999 });
      }
    });
    matches.sort(function(a, b) { return a.matchIndex - b.matchIndex; });
    if (matches.length === 0) {
      empAutocomplete.innerHTML = '<div class="autocomplete-no-result">🔍 Không tìm thấy tên chứa "' + val + '"</div>';
      empAutocomplete.style.display = 'block';
      return;
    }
    var maxResults = Math.min(matches.length, 10);
    var countDiv = document.createElement('div');
    countDiv.className = 'autocomplete-count';
    countDiv.textContent = 'Tìm thấy ' + matches.length + ' tên';
    empAutocomplete.appendChild(countDiv);
    for (var i = 0; i < maxResults; i++) {
      var match = matches[i],
        div = document.createElement('div');
      div.className = 'autocomplete-item';
      var iconSpan = document.createElement('span');
      iconSpan.className = 'add-icon';
      iconSpan.textContent = '＋';
      div.appendChild(iconSpan);
      var nameSpan = document.createElement('span');
      nameSpan.style.cssText = 'flex:1;white-space:nowrap;';
      var name = match.employee.name,
        query = val,
        nameLower = name.toLowerCase(),
        queryLower = query.toLowerCase(),
        nameNoAccent = removeAccents(nameLower),
        queryNoAccent = removeAccents(queryLower);
      var matchStart = nameLower.indexOf(queryLower),
        matchLength = query.length;
      if (matchStart === -1) {
        matchStart = nameNoAccent.indexOf(queryNoAccent);
        if (matchStart !== -1) matchLength = queryNoAccent.length;
      }
      if (matchStart !== -1) {
        nameSpan.appendChild(document.createTextNode(name.substring(0, matchStart)));
        var hl = document.createElement('span');
        hl.className = 'highlight-match';
        hl.textContent = name.substring(matchStart, matchStart + matchLength);
        nameSpan.appendChild(hl);
        nameSpan.appendChild(document.createTextNode(name.substring(matchStart + matchLength)));
      } else nameSpan.textContent = name;
      div.appendChild(nameSpan);
      div.addEventListener('click', function(empName) {
        return function() {
          addSelectedEmployee(empName);
        };
      }(match.employee.name));
      empAutocomplete.appendChild(div);
    }
    empAutocomplete.style.display = 'block';
  });
  document.addEventListener('click', function(e) {
    if (e.target !== empInput && !empAutocomplete.contains(e.target)) empAutocomplete.style.display = 'none';
  });
  empInput.addEventListener('focus', function() {
    if (this.value.trim()) this.dispatchEvent(new Event('input'));
  });
  empInput.addEventListener('keydown', function(e) {
    var items = empAutocomplete.querySelectorAll('.autocomplete-item'),
      activeItem = empAutocomplete.querySelector('.autocomplete-item.active'),
      currentIndex = Array.from(items).indexOf(activeItem);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (items.length) {
        if (activeItem) activeItem.classList.remove('active');
        currentIndex = (currentIndex + 1) % items.length;
        items[currentIndex].classList.add('active');
        items[currentIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (items.length) {
        if (activeItem) activeItem.classList.remove('active');
        currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        items[currentIndex].classList.add('active');
        items[currentIndex].scrollIntoView({ block: 'nearest' });
      }
    } else if (e.key === 'Enter') {
      if (activeItem) { e.preventDefault();
        activeItem.click(); }
    } else if (e.key === 'Escape') {
      empAutocomplete.style.display = 'none';
    }
  });
  empInput.addEventListener('blur', function() {
    setTimeout(function() {
      if (!empAutocomplete.contains(document.activeElement)) empAutocomplete.style.display = 'none';
    }, 200);
  });
}

function initNoteCharCount() {
  var noteInput = document.getElementById('attNote'),
    charCount = document.getElementById('noteCharCount');
  if (!noteInput || !charCount) return;
  noteInput.addEventListener('input', function() {
    var len = this.value.length;
    charCount.textContent = len + '/500';
    charCount.classList.remove('warning', 'danger');
    if (len > 400) charCount.classList.add('warning');
    if (len > 480) charCount.classList.add('danger');
  });
}

function updateNoteCharCount(len) {
  var charCount = document.getElementById('noteCharCount');
  if (!charCount) return;
  charCount.textContent = (len || 0) + '/500';
  charCount.classList.remove('warning', 'danger');
  if (len > 400) charCount.classList.add('warning');
  if (len > 480) charCount.classList.add('danger');
}

function refreshAllAutocompletes() {
  document.querySelectorAll('.autocomplete-list').forEach(function(list) {
    list.style.display = 'none';
    list.innerHTML = '';
  });
  var inputs = ['employeeInput', 'statsEmpInput', 'personalEmpInput', 'modalEmpInput'];
  inputs.forEach(function(id) {
    var input = document.getElementById(id);
    if (input) input.value = '';
  });
  if (typeof renderMissingEmployees === 'function') renderMissingEmployees();
  if (typeof rEmp === 'function') rEmp();
}

// ==================== TAB FUNCTIONS ====================
window.switchTab = function(n) {
  ['ChamCong', 'ThongKe', 'CaNhan', 'QuanLy'].forEach(function(t) {
    document.getElementById('tab' + t).classList.remove('active');
    document.getElementById('page' + t).style.display = 'none';
  });
  document.getElementById('tab' + n).classList.add('active');
  document.getElementById('page' + n).style.display = 'block';
  if (n === 'ChamCong') {
    renderMissingEmployees();
  }
  if (n === 'CaNhan') {
    renderPersonalTab();
  }
  if (n === 'ThongKe') {
    var from = statsFilterState.fromDate || '';
    if (from) {
      var parts = from.split('-');
      if (parts.length === 3) {
        heatmapState.year = parseInt(parts[0]);
        heatmapState.month = parseInt(parts[1]);
      }
    } else {
      var now = new Date();
      heatmapState.year = now.getFullYear();
      heatmapState.month = now.getMonth() + 1;
    }
    renderStatistics();
  }
  if (n === 'QuanLy') {
    rGFull();
    rEmp();
    rShiftList();
  }
};

// ==================== SHIFT FUNCTIONS ====================
function rShifts() {
  var g = document.getElementById('shiftGrid');
  if (!g) return;
  g.innerHTML = '';
  shifts.forEach(function(s, i) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'shift-btn';
    b.id = 'shift-' + i;
    b.onclick = function() { selShift(i); };
    b.innerHTML = '<div class="shift-icon">' + (s.icon || '🔹') + '</div><div class="shift-name">' + s.name + '</div><div class="shift-time">' + (s.time || '') + '</div>';
    g.appendChild(b);
  });
  selShift(0);
}

function selShift(index) {
  document.querySelectorAll('.shift-btn').forEach(function(btn) {
    btn.classList.remove('active');
  });
  var btns = document.querySelectorAll('.shift-btn');
  if (btns[index]) btns[index].classList.add('active');
  var shiftName = shifts[index] ? shifts[index].name : '';
  var eatValue = 'Có';
  if (shiftName === 'Ca 3' || shiftName === '1/2 Ca' || shiftName === 'Nghỉ') {
    eatValue = 'Không';
  }
  var eatRadio = document.querySelector('input[name="eat"][value="' + eatValue + '"]');
  if (eatRadio) eatRadio.click();
}

window.getShift = function() {
  var a = document.querySelector('.shift-btn.active');
  if (!a) return '';
  var i = parseInt(a.id.split('-')[1]);
  return shifts[i].name + ' (' + shifts[i].time + ')';
};

function rShiftList() {
  var el = document.getElementById('shiftList');
  if (!el) return;
  el.innerHTML = '';
  shifts.forEach(function(s) {
    el.innerHTML += '<div class="list-item"><span>' + (s.icon || '') + ' <b>' + s.name + '</b> <span class="muted">' + (s.time || '') + '</span></span><button class="btn btn-xs btn-danger" data-id="' + s.id + '" data-act="delS">🗑</button></div>';
  });
}

// ==================== GROUPS FUNCTIONS ====================
function rGCompact() {
  var w = document.getElementById('groupsCompact');
  if (!w) return;
  w.innerHTML = '';
  groups.forEach(function(g, idx) {
    var hasTasks = g.items && g.items.length > 0;
    var frame = document.createElement('div');
    frame.className = 'group-compact-frame';
    frame.setAttribute('data-group-id', g.id);
    var header = document.createElement('div');
    header.className = 'group-compact-header';
    header.onclick = function(e) {
      e.stopPropagation();
      var f = this.closest('.group-compact-frame');
      if (f) f.classList.toggle('open');
    };
    var headerLeft = document.createElement('div');
    headerLeft.className = 'group-compact-header-left';
    var dot = document.createElement('span');
    dot.className = 'group-compact-dot';
    dot.style.backgroundColor = g.color || '#d1d5db';
    headerLeft.appendChild(dot);
    var title = document.createElement('span');
    title.className = 'group-compact-title';
    title.textContent = g.title;
    headerLeft.appendChild(title);
    header.appendChild(headerLeft);
    var headerRight = document.createElement('div');
    headerRight.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;';
    var badge = document.createElement('span');
    badge.className = 'group-compact-badge';
    badge.textContent = hasTasks ? g.items.length : '0';
    headerRight.appendChild(badge);
    var arrow = document.createElement('span');
    arrow.className = 'group-compact-arrow';
    arrow.textContent = '▼';
    headerRight.appendChild(arrow);
    header.appendChild(headerRight);
    frame.appendChild(header);
    var body = document.createElement('div');
    body.className = 'group-compact-body';
    if (!hasTasks) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'group-compact-empty';
      emptyDiv.textContent = '📭 Chưa có công đoạn';
      body.appendChild(emptyDiv);
    } else {
      var tasksContainer = document.createElement('div');
      tasksContainer.className = 'group-compact-tasks';
      g.items.forEach(function(it) {
        var taskDiv = document.createElement('div');
        taskDiv.className = 'group-compact-task';
        taskDiv.id = 'crow-' + it.id;
        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-checkbox';
        checkbox.setAttribute('data-task', it.id);
        checkbox.setAttribute('data-group', g.id);
        checkbox.onchange = function() {
          tglRow(it.id, this.checked);
          if (this.checked) {
            taskDiv.classList.add('checked');
          } else {
            taskDiv.classList.remove('checked');
          }
        };
        taskDiv.appendChild(checkbox);
        var taskName = document.createElement('span');
        taskName.className = 'group-compact-task-name';
        taskName.textContent = it.name;
        taskDiv.appendChild(taskName);
        taskName.addEventListener('click', function(e) {
          e.stopPropagation();
          checkbox.checked = !checkbox.checked;
          checkbox.onchange();
        });
        tasksContainer.appendChild(taskDiv);
      });
      body.appendChild(tasksContainer);
    }
    frame.appendChild(body);
    w.appendChild(frame);
  });
}

window.tglRow = function(id, chk) {
  var r = document.getElementById('crow-' + id);
  if (r) {
    if (chk) {
      r.classList.add('checked');
    } else {
      r.classList.remove('checked');
    }
  }
};

function rGFull() {
  var w = document.getElementById('groupsWrap');
  if (!w) return;
  w.innerHTML = '';
  var countEl = document.getElementById('groupCount');
  if (countEl) countEl.textContent = groups.length + ' nhóm';
  groups.forEach(function(g) {
    var o = expanded[g.id] !== false,
      h = '';
    if (g.items.length === 0) {
      h = '<div class="group-frame-empty">📭 Chưa có công đoạn</div>';
    } else {
      h = '<div class="task-list" data-g="' + g.id + '">';
      g.items.forEach(function(it, i) {
        h += '<div class="task-item" draggable="true" data-id="' + it.id + '" data-group="' + g.id + '"><span class="task-drag-handle">⋮⋮</span><span class="task-number">' + (i + 1) + '</span><span class="task-name">' + it.name + '</span><div class="task-actions"><button class="btn btn-xs" onclick="mvTask(\'' + it.id + '\',-1);event.stopPropagation()">▲</button><button class="btn btn-xs" onclick="mvTask(\'' + it.id + '\',1);event.stopPropagation()">▼</button><button class="btn btn-xs" onclick="edTask(\'' + it.id + '\');event.stopPropagation()">✏️</button><button class="btn btn-xs btn-danger" onclick="rmTask(\'' + it.id + '\');event.stopPropagation()">🗑</button></div></div>';
      });
      h += '</div>';
    }
    w.innerHTML += '<div class="group-frame' + (o ? ' open' : '') + '" data-gid="' + g.id + '"><div class="group-frame-header" onclick="tglGF(\'' + g.id + '\')"><div class="group-info"><div class="group-icon" style="background:' + (g.color || '#d1d5db') + '20;color:' + (g.color || '#d1d5db') + '">📁</div><span class="group-name">' + g.title + '</span></div><div class="group-meta"><span class="group-badge' + (g.items.length > 0 ? ' has-items' : '') + '">📋 ' + g.items.length + '</span><span class="group-toggle-icon">▼</span></div></div><div class="group-frame-body">' + h + '</div><div class="group-frame-footer"><button class="btn btn-xs" onclick="mvG(\'' + g.id + '\',-1);event.stopPropagation()">▲</button><button class="btn btn-xs" onclick="mvG(\'' + g.id + '\',1);event.stopPropagation()">▼</button><button class="btn btn-xs" onclick="addT(\'' + g.id + '\');event.stopPropagation()">+ Thêm</button><button class="btn btn-xs btn-danger" onclick="clrT(\'' + g.id + '\');event.stopPropagation()">Xóa hết</button><button class="btn btn-xs" onclick="copyGroupTasks(\'' + g.id + '\');event.stopPropagation()" title="Sao chép tất cả công đoạn">📋</button><button class="btn btn-xs" onclick="rnG(\'' + g.id + '\');event.stopPropagation()">✏️</button><input type="color" value="' + (g.color || '#d1d5db') + '" onchange="setGC(\'' + g.id + '\',this.value);event.stopPropagation()" style="width:24px;height:24px;padding:1px;border:1px solid #d1d5db;border-radius:4px;cursor:pointer" /></div></div>';
  });
  setupDD();
}

window.tglGF = function(gid) {
  var f = document.querySelector('.group-frame[data-gid="' + gid + '"]');
  if (!f) return;
  f.classList.toggle('open');
  expanded[gid] = f.classList.contains('open');
};

var dragId = null;

function setupDD() {
  document.querySelectorAll('.task-item[draggable="true"]').forEach(function(t) {
    t.addEventListener('dragstart', function(e) {
      if (e.target.closest('button')) { e.preventDefault();
        return; }
      dragId = this.dataset.id;
      this.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    t.addEventListener('dragend', function() {
      this.classList.remove('dragging');
      dragId = null;
    });
  });
  document.querySelectorAll('.task-list').forEach(function(l) {
    l.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.classList.add('dragover');
    });
    l.addEventListener('dragleave', function() {
      this.classList.remove('dragover');
    });
    l.addEventListener('drop', function(e) {
      e.preventDefault();
      this.classList.remove('dragover');
      if (dragId && this.dataset.g) moveTG(dragId, this.dataset.g);
      dragId = null;
    });
  });
}

function moveTG(tid, tgid) {
  var f = null;
  groups.forEach(function(g) {
    g.items.forEach(function(it, i) {
      if (it.id === tid) f = { g: g, idx: i, item: it };
    });
  });
  if (!f || f.g.id === tgid) return;
  f.g.items.splice(f.idx, 1);
  var tg = groups.find(function(g) { return g.id === tgid; });
  if (!tg) return;
  tg.items.push(f.item);
  saveG('Di chuyển công việc');
}

window.addG = function() {
  var n = document.getElementById('newGroupName').value.trim();
  if (!n) { showAlert('Nhập tên nhóm!'); return; }
  var c = document.getElementById('newGroupColor').value;
  groups.push({ id: 'g' + Date.now(), title: n, color: c, items: [] });
  expanded['g' + Date.now()] = true;
  saveG('Thêm nhóm: ' + n);
  document.getElementById('newGroupName').value = '';
};

window.mvG = function(gid, off) {
  var i = groups.findIndex(function(g) { return g.id === gid; });
  if (i < 0 || i + off < 0 || i + off >= groups.length) return;
  var g = groups.splice(i, 1)[0];
  groups.splice(i + off, 0, g);
  saveG('Di chuyển nhóm');
};

window.addT = async function(gid) {
  var g = groups.find(function(g) { return g.id === gid; });
  if (!g) return;
  var n = await showPrompt('Tên công đoạn:', '', 'Thêm công đoạn');
  if (!n || !n.trim()) return;
  g.items.push({ id: 't' + Date.now(), name: n.trim() });
  expanded[gid] = true;
  saveG('Thêm công đoạn: ' + n.trim());
};

window.clrT = async function(gid) {
  var g = groups.find(function(g) { return g.id === gid; });
  if (!g || g.items.length === 0) { showAlert('Nhóm trống!'); return; }
  if (!await showConfirm('Xóa tất cả công đoạn trong nhóm?')) return;
  g.items = [];
  saveG('Xóa tất cả công đoạn');
};

window.mvTask = function(tid, off) {
  var found = false;
  groups.forEach(function(g) {
    var i = g.items.findIndex(function(it) { return it.id === tid; });
    if (i >= 0 && i + off >= 0 && i + off < g.items.length) {
      var it = g.items.splice(i, 1)[0];
      g.items.splice(i + off, 0, it);
      found = true;
    }
  });
  if (found) saveG('Sắp xếp công đoạn');
};

window.edTask = async function(tid) {
  groups.forEach(function(g) {
    var it = g.items.find(function(it) { return it.id === tid; });
    if (it) {
      showPrompt('Sửa công đoạn:', it.name, 'Sửa').then(function(n) {
        if (n && n.trim() && n.trim() !== it.name) {
          it.name = n.trim();
          saveG('Sửa công đoạn: ' + n.trim());
        }
      });
    }
  });
};

window.rmTask = async function(tid) {
  groups.forEach(function(g) {
    var i = g.items.findIndex(function(it) { return it.id === tid; });
    if (i >= 0) {
      showConfirm('Xóa công đoạn "' + g.items[i].name + '"?', 'Xóa').then(function(ok) {
        if (ok) {
          g.items.splice(i, 1);
          saveG('Xóa công đoạn');
        }
      });
    }
  });
};

window.setGC = function(gid, c) {
  var g = groups.find(function(g) { return g.id === gid; });
  if (g) { g.color = c;
    S(GROUP_KEY, groups);
    rGFull();
    rGCompact(); }
};

window.rnG = async function(gid) {
  var g = groups.find(function(g) { return g.id === gid; });
  if (!g) return;
  var n = await showPrompt('Nhập tên mới:', g.title, 'Đổi tên nhóm');
  if (n && n.trim()) { g.title = n.trim();
    saveG('Đổi tên nhóm: ' + n.trim()); }
};

function saveG(m) {
  S(GROUP_KEY, groups);
  log(m);
  rGFull();
  rGCompact();
}

window.copyGroupTasks = async function(gid) {
  var g = groups.find(function(g) { return g.id === gid; });
  if (!g || !g.items || g.items.length === 0) {
    showAlert('Nhóm này chưa có công đoạn nào!', 'Thông báo');
    return;
  }
  var text = g.items.map(function(it) { return it.name; }).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    showAlert('✅ Đã sao chép ' + g.items.length + ' công đoạn:\n\n' + text.replace(/\n/g, '\n• '), 'Thành công');
  } catch (err) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showAlert('✅ Đã sao chép ' + g.items.length + ' công đoạn!', 'Thành công');
    } catch (e) {
      showAlert('❌ Không thể sao chép. Vui lòng thử lại!', 'Lỗi');
    }
    document.body.removeChild(textarea);
  }
};

// ==================== EMPLOYEE FUNCTIONS ====================
function rEmp() {
  var el = document.getElementById('empList');
  if (!el) return;
  el.innerHTML = '';
  var countEl = document.getElementById('empCount');
  if (countEl) countEl.textContent = emp.length + ' NV';
  var displayEmp = emp;
  if (!isAdmin) {
    var hiddenEmps = JSON.parse(localStorage.getItem('hidden_emps') || '[]');
    displayEmp = emp.filter(function(e) { return hiddenEmps.indexOf(e.id) === -1; });
    if (countEl) countEl.textContent = displayEmp.length + ' NV';
  }
  if (!displayEmp.length) { el.innerHTML = '<div class="muted" style="padding:12px;text-align:center">Chưa có NV</div>'; return; }
  var sortedEmp = displayEmp.slice().sort(function(a, b) { return removeAccents(a.name).localeCompare(removeAccents(b.name)); });
  var hiddenEmps = JSON.parse(localStorage.getItem('hidden_emps') || '[]');
  sortedEmp.forEach(function(e) {
    var cleanName = cleanEmployeeName(e.name);
    var isHidden = hiddenEmps.indexOf(e.id) > -1;
    el.innerHTML += '<div class="list-item">' +
      '<span style="flex:1; ' + (isHidden ? 'opacity:0.5; text-decoration:line-through;' : '') + '">' + cleanName + '</span>' +
      '<div class="actions">' +
      (isAdmin ? '<button class="btn btn-xs" data-id="' + e.id + '" data-act="edit">✏️</button>' +
        '<button class="btn btn-xs btn-danger" data-id="' + e.id + '" data-act="del">🗑</button>' +
        '<button class="btn btn-xs" data-id="' + e.id + '" data-act="toggle" title="' + (isHidden ? 'Hiện' : 'Ẩn') + '">' + (isHidden ? '👁' : '🔒') + '</button>' : '') +
      '</div></div>';
  });
}

var elEL = document.getElementById('empList');
if (elEL) {
  elEL.addEventListener('click', function(e) {
    var b = e.target.closest('button[data-act]');
    if (b) hEA(b);
  });
}

async function hEA(b) {
  var a = b.dataset.act,
    id = b.dataset.id;
  if (a === 'toggle') {
    var hiddenEmps = getHiddenEmployees();
    var idx = hiddenEmps.indexOf(id);
    var empInfo = emp.find(function(e) { return e.id === id; });
    var empName = empInfo ? cleanEmployeeName(empInfo.name) : 'Nhân viên';
    if (idx > -1) {
      hiddenEmps.splice(idx, 1);
      await saveHiddenEmployees(hiddenEmps);
      showAlert('✅ Đã hiện nhân viên "' + empName + '" trở lại!', 'Thành công');
    } else {
      hiddenEmps.push(id);
      await saveHiddenEmployees(hiddenEmps);
      showAlert('🔒 Đã ẩn nhân viên "' + empName + '"\n\n⚠️ Nhân viên này sẽ không hiển thị trong danh sách chấm công!', 'Đã ẩn');
    }
    rEmp();
    refreshAllAutocompletes();
    return;
  }
  if (a === 'del') {
    var e = emp.find(function(x) { return x.id === id; });
    if (!e) return;
    if (!await showConfirm('Xóa nhân viên "' + e.name + '"?', 'Xóa')) return;
    emp = emp.filter(function(x) { return x.id !== id; });
    S(EMP_KEY, emp);
    log('Xóa nhân viên: ' + e.name);
    rEmp();
  } else if (a === 'edit') {
    var e = emp.find(function(x) { return x.id === id; });
    if (!e) return;
    var n = await showPrompt('Sửa tên nhân viên:', e.name, 'Sửa');
    if (!n || !n.trim()) return;
    e.name = n.trim();
    S(EMP_KEY, emp);
    log('Sửa nhân viên: ' + e.name);
    rEmp();
  }
}

window.addEmp = async function() {
  var nEl = document.getElementById('empName');
  if (!nEl) return;
  var n = nEl.value.trim();
  if (!n) { await showAlert('Nhập tên nhân viên!'); return; }
  if (emp.some(function(e) { return removeAccents(e.name.toLowerCase()) === removeAccents(n.toLowerCase()); })) {
    await showAlert('Nhân viên "' + n + '" đã tồn tại!');
    return;
  }
  emp.push({ id: 'e' + Date.now(), name: n });
  S(EMP_KEY, emp);
  log('Thêm nhân viên: ' + n);
  nEl.value = '';
  rEmp();
};

window.clrEmp = async function() {
  if (!emp.length) { await showAlert('Danh sách đã trống!'); return; }
  if (!await showConfirm('XÓA TẤT CẢ NHÂN VIÊN?\nHành động này không thể hoàn tác!')) return;
  emp = [];
  S(EMP_KEY, emp);
  log('Xóa tất cả nhân viên');
  rEmp();
};

// ==================== IMPORT CSV ====================
var impF = document.getElementById('importEmpFile'),
  impB = document.getElementById('importEmpBtn');
if (impF) {
  impF.onchange = function(e) {
    var f = e.target.files[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { showAlert('File quá lớn (tối đa 5MB)!');
      impF.value = '';
      return; }
    selFile = f;
    document.getElementById('fileName').textContent = f.name + ' (' + fmtSize(f.size) + ')';
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('fileInfo').style.display = 'flex';
    if (impB) { impB.disabled = false;
      impB.style.opacity = '1'; }
  };
}

window.removeFile = function() {
  selFile = null;
  if (impF) impF.value = '';
  document.getElementById('uploadArea').style.display = 'block';
  document.getElementById('fileInfo').style.display = 'none';
  if (impB) { impB.disabled = true;
    impB.style.opacity = '0.6'; }
  document.getElementById('importProgress').classList.remove('show');
};

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

if (impB) {
  impB.onclick = async function() {
    if (!selFile) { await showAlert('Vui lòng chọn file CSV!'); return; }
    var prog = document.getElementById('importProgress');
    prog.classList.add('show');
    prog.textContent = '⏳ Đang đọc file CSV...';
    impB.disabled = true;
    try {
      var text = await readFileAsText(selFile);
      prog.textContent = '⏳ Đang phân tích dữ liệu...';
      var names = parseCSV(text);
      if (!names.length) { await showAlert('Không tìm thấy tên trong file!'); return; }
      prog.textContent = '⏳ Đang thêm ' + names.length + ' nhân viên...';
      await addNames(names);
    } catch (err) {
      await showAlert('❌ Lỗi: ' + err.message);
    } finally {
      prog.classList.remove('show');
      impB.disabled = false;
      removeFile();
    }
  };
}

function readFileAsText(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result); };
    reader.onerror = function() { reject(new Error('Không thể đọc file')); };
    reader.readAsText(file, 'UTF-8');
  });
}

function parseCSV(text) {
  var lines = text.split(/\r?\n/);
  var names = [];
  var startRow = 0;
  if (lines.length > 0 && /tên|ten|name|họ|ho|nhân viên|nhan vien|employee/i.test(lines[0].toLowerCase())) startRow = 1;
  for (var i = startRow; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var cols = line.split(/[,\t;|]/);
    for (var j = 0; j < cols.length; j++) {
      var val = cols[j].trim().replace(/^["']|["']$/g, '');
      if (val && val.length >= 2 && !/^\d+$/.test(val)) { names.push(val); break; }
    }
  }
  return [...new Set(names)];
}

async function addNames(names) {
  var added = 0,
    skipped = 0;
  for (var i = 0; i < names.length; i++) {
    var n = names[i].trim();
    if (!n || n.length < 2) continue;
    if (emp.some(function(e) { return removeAccents(e.name.toLowerCase()) === removeAccents(n.toLowerCase()); })) { skipped++; continue; }
    emp.push({ id: 'e' + Date.now() + Math.random().toString(36).substr(2, 5), name: n });
    added++;
  }
  S(EMP_KEY, emp);
  if (added > 0) log('Import ' + added + ' nhân viên');
  var msg = added > 0 ? '✅ Đã thêm ' + added + ' nhân viên!' : '⚠️ Không có nhân viên mới.';
  if (skipped > 0) msg += '\n⏭️ Bỏ qua ' + skipped + ' nhân viên (đã tồn tại)';
  await showAlert(msg, added > 0 ? 'Thành công' : 'Thông báo');
  rEmp();
}

// ==================== SHIFT MANAGEMENT ====================
async function hDS(id) {
  if (!await showConfirm('Xóa ca làm việc này?')) return;
  shifts = shifts.filter(function(s) { return s.id !== id; });
  S(SHIFT_KEY, shifts);
  log('Xóa ca làm việc');
  rShiftList();
  rShifts();
}

window.addShift = async function() {
  var nEl = document.getElementById('shiftName'),
    tEl = document.getElementById('shiftTime'),
    iEl = document.getElementById('shiftIcon');
  if (!nEl || !tEl || !iEl) return;
  var n = nEl.value.trim(),
    t = tEl.value.trim(),
    i = iEl.value.trim() || '🔹';
  if (!n) { await showAlert('Nhập tên ca!'); return; }
  if (!t) { await showAlert('Nhập thời gian ca!'); return; }
  shifts.push({ id: 's' + Date.now(), name: n, time: t, icon: i });
  S(SHIFT_KEY, shifts);
  log('Thêm ca: ' + n);
  nEl.value = '';
  tEl.value = '';
  iEl.value = '🔹';
  rShiftList();
  rShifts();
};

// ==================== AUDIT FUNCTIONS ====================
function renderAudit() {
  var logs = L(AUDIT_KEY, []),
    el = document.getElementById('auditLog');
  if (!el) return;
  el.innerHTML = '';
  if (!logs.length) { el.innerHTML = '<div class="muted" style="padding:8px;text-align:center">Trống</div>'; return; }
  var html = '';
  logs.slice(0, 50).forEach(function(l) {
    html += '<div class="audit-item"><span class="audit-time">' + new Date(l.time).toLocaleString('vi-VN') + '</span><span>' + l.msg + '</span></div>';
  });
  el.innerHTML = html;
}

window.clearAudit = async function() {
  if (!await showConfirm('Xóa tất cả nhật ký?')) return;
  S(AUDIT_KEY, []);
  renderAudit();
};

// ==================== GROUPS IMPORT/EXPORT ====================
window.expG = function() {
  var blob = new Blob([JSON.stringify(groups, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nhom_cong_viec.json';
  a.click();
  log('Xuất nhóm công việc');
};

window.impG = function(input) {
  var f = input.files[0];
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var d = JSON.parse(e.target.result);
      if (d instanceof Array && d.length > 0) {
        groups = d;
        expanded = {};
        saveG('Nhập nhóm công việc');
        showAlert('✅ Nhập thành công ' + groups.length + ' nhóm!');
      } else {
        showAlert('Sai định dạng file!');
      }
    } catch (err) {
      showAlert('Lỗi đọc file JSON!');
    }
  };
  reader.readAsText(f);
  input.value = '';
};

window.rstG = async function() {
  if (!await showConfirm('Reset nhóm công việc về mặc định?')) return;
  groups = JSON.parse(JSON.stringify(D_GROUPS));
  expanded = {};
  saveG('Reset nhóm công việc');
  await showAlert('✅ Đã reset thành công!');
};

// ==================== ATTENDANCE FUNCTIONS ====================
window.subAtt = async function(e, keepTimestamp) {
  if (e) e.preventDefault();
  if (selectedEmployees.length === 0) { await showAlert('Vui lòng chọn ít nhất 1 nhân viên!'); return false; }
  var dt = document.getElementById('attDate').value || new Date().toISOString().split('T')[0];
  var sh = getShift();
  if (!sh) { await showAlert('Vui lòng chọn ca làm việc!'); return false; }
  var et = document.querySelector('input[name="eat"]:checked');
  et = et ? et.value : 'Có';
  var note = document.getElementById('attNote')?.value?.trim() || '';
  var ts = [];
  document.querySelectorAll('.task-checkbox:checked').forEach(function(cb) {
    var g = groups.find(function(g) { return g.id === cb.dataset.group; });
    var t = g ? g.items.find(function(it) { return it.id === cb.dataset.task; }) : null;
    if (t) ts.push({ group: g.title, task: t.name });
  });
  var rec = L(REC_KEY, []);
  var timestamp = keepTimestamp || new Date().toISOString();
  var shiftName = sh ? sh.split('(')[0].trim() : '';
  if (shiftName !== 'Nghỉ' && (!ts || ts.length === 0)) {
    await showAlert('⚠️ Vui lòng chọn ít nhất 1 công đoạn làm việc!', 'Thiếu thông tin');
    return false;
  }
  var attDateCheck = dt.split('T')[0];
  var taskNamesCheck = (ts || []).map(function(t) { return t.task; }).sort().join(',');
  var existingRecords = L(REC_KEY, []);
  var duplicateNames = [];
  var tempSelected = selectedEmployees.slice();
  tempSelected.forEach(function(en) {
    var duplicate = existingRecords.some(function(r) {
      var rTaskNames = (r.tasks || []).map(function(t) { return t.task; }).sort().join(',');
      return r.employee === en &&
        r.date === attDateCheck &&
        (r.shift || '').split('(')[0].trim() === shiftName &&
        rTaskNames === taskNamesCheck;
    });
    if (duplicate) duplicateNames.push(cleanEmployeeName(en));
  });
  if (duplicateNames.length > 0) {
    await showAlert('⚠️ Đã có bản ghi TRÙNG hoàn toàn (cùng ca + cùng công đoạn):\n\n' + duplicateNames.join(', ') + '\n\nHệ thống đã bỏ qua họ.', 'Cảnh báo trùng');
    selectedEmployees = selectedEmployees.filter(function(en) {
      return duplicateNames.indexOf(cleanEmployeeName(en)) === -1;
    });
    if (selectedEmployees.length === 0) return false;
  }
  for (var i = 0; i < selectedEmployees.length; i++) {
    var en = selectedEmployees[i];
    if (!emp.some(function(e) { return removeAccents(e.name.toLowerCase()) === removeAccents(en.toLowerCase()); })) {
      emp.push({ id: 'e' + Date.now(), name: en });
      S(EMP_KEY, emp);
    }
      // Kiểm tra nếu nhân viên được chọn nhiều hơn 1 công đoạn
  var hasMultipleTasks = (ts || []).length > 1;
  
  if (hasMultipleTasks) {
      var taskList = (ts || []).map(function(t) { return t.task; }).join(', ');
      var confirmed = await showConfirm(
          '⚠️ Bạn đang chọn ' + ts.length + ' công đoạn cho nhân viên:\n\n' + 
          taskList + '\n\n' +
          'Bạn có chắc chắn muốn lưu?', 
          'Cảnh báo nhiều công đoạn'
      );
      
      if (!confirmed) return false;
  }
  
  rec.push({
      id: 'rec_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 4),
      employee: en,
      date: dt.split('T')[0],
      shift: sh,
      eat: et,
      tasks: ts,
      note: note,
      timestamp: timestamp,
      lastModified: Date.now()
    });
  }
  rec.sort(function(a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  S(REC_KEY, rec);
  log('Chấm công: ' + selectedEmployees.length + ' NV - ' + formatDate(dt));
  var msg = '✅ Đã lưu chấm công cho ' + selectedEmployees.length + ' nhân viên!';
  if (note) msg += '\n📝 Ghi chú: ' + note.substring(0, 50) + (note.length > 50 ? '...' : '');
  await showAlert(msg);
  rstForm();
  renderStatistics();
  renderMissingEmployees();
  return false;
};

window.rstForm = function() {
  var dateInput = document.getElementById('attDate');
  var currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
  var activeShiftBtn = document.querySelector('.shift-btn.active');
  var currentShiftIndex = 0;
  if (activeShiftBtn) {
    currentShiftIndex = parseInt(activeShiftBtn.id.split('-')[1]);
  }
  selectedEmployees = [];
  renderSelectedEmployees();
  var empInput = document.getElementById('employeeInput');
  if (empInput) { empInput.value = '';
    empInput.focus(); }
  var autoC = document.getElementById('empAutocomplete');
  if (autoC) { autoC.innerHTML = '';
    autoC.style.display = 'none'; }
  if (dateInput) { dateInput.value = currentDate; }
  selShift(currentShiftIndex);
  var eatRadio = document.querySelector('input[name="eat"][value="Có"]');
  if (eatRadio) eatRadio.checked = true;
  document.querySelectorAll('.group-compact-task').forEach(function(t) { t.classList.remove('checked'); });
  document.querySelectorAll('.task-checkbox').forEach(function(cb) { cb.checked = false; });
  var noteInput = document.getElementById('attNote');
  if (noteInput) { noteInput.value = ''; }
  updateNoteCharCount(0);
  renderMissingEmployees();
  var activeShift = document.querySelector('.shift-btn.active');
  if (activeShift) {
    var shiftBtns = document.querySelectorAll('.shift-btn');
    for (var i = 0; i < shiftBtns.length; i++) {
      if (shiftBtns[i] === activeShift) {
        var shiftName = shifts[i] ? shifts[i].name : '';
        var eatValue = (shiftName === 'Ca 3' || shiftName === '1/2 Ca' || shiftName === 'Nghỉ') ? 'Không' : 'Có';
        var eatRadio2 = document.querySelector('input[name="eat"][value="' + eatValue + '"]');
        if (eatRadio2) eatRadio2.click();
        break;
      }
    }
  }
};

// ==================== MISSING EMPLOYEES ====================
window.toggleMissingEmp = function() {
  var section = document.getElementById('missingEmpSection');
  if (section) section.classList.toggle('open');
};

window.refreshMissingEmp = function() {
  renderMissingEmployees();
};

function getMissingEmployees() {
  var now = new Date();
  var currentYear = now.getFullYear();
  var currentMonth = now.getMonth() + 1;
  var currentDay = now.getDate();
  var monthPrefix = currentYear + '-' + String(currentMonth).padStart(2, '0');
  var allRecords = L(REC_KEY, []);
  var empDaysMap = {};
  emp.forEach(function(e) {
    empDaysMap[e.name] = new Set();
  });
  allRecords.forEach(function(r) {
    if (r.date.startsWith(monthPrefix) && empDaysMap[r.employee]) {
      empDaysMap[r.employee].add(r.date);
    }
  });
  var missing = [];
  emp.forEach(function(e) {
    var missingDays = [];
    for (var day = 1; day <= currentDay; day++) {
      var dateStr = monthPrefix + '-' + String(day).padStart(2, '0');
      if (!empDaysMap[e.name].has(dateStr)) {
        missingDays.push(dateStr);
      }
    }
    if (missingDays.length > 0) {
      missing.push({ name: e.name, missingDays: missingDays });
    }
  });
  missing.sort(function(a, b) {
    return b.missingDays.length - a.missingDays.length;
  });
  return missing;
}

function renderMissingEmployees() {
  var listEl = document.getElementById('missingEmpList');
  var countEl = document.getElementById('missingEmpCount');
  if (!listEl || !countEl) return;
  var missing = getMissingEmployees();
  countEl.textContent = missing.length;
  countEl.className = 'missing-emp-count';
  if (missing.length === 0) countEl.classList.add('zero');
  if (missing.length === 0) {
    listEl.innerHTML = '<div class="missing-emp-empty">✅ Tất cả nhân viên đã được chấm công đầy đủ trong tháng!</div>';
  } else {
    listEl.innerHTML = '';
    var totalMissingDays = 0;
    missing.forEach(function(item) {
      totalMissingDays += item.missingDays.length;
    });
    var summaryDiv = document.createElement('div');
    summaryDiv.style.cssText = 'width:100%;padding:4px 0 8px 0;font-size:12px;color:#92400e;font-weight:600;';
    summaryDiv.textContent = '📊 ' + missing.length + ' nhân viên thiếu tổng cộng ' + totalMissingDays + ' ngày công';
    listEl.appendChild(summaryDiv);
    missing.forEach(function(item) {
      var empDiv = document.createElement('div');
      empDiv.style.cssText = 'width:100%;margin-bottom:8px;';
      var nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'font-weight:700;font-size:13px;color:#78350f;margin-bottom:4px;display:flex;align-items:center;gap:6px;';
      nameDiv.innerHTML = '👤 ' + cleanEmployeeName(item.name) +
        ' <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;">Thiếu ' +
        item.missingDays.length + ' ngày</span>';
      empDiv.appendChild(nameDiv);
      var daysDiv = document.createElement('div');
      daysDiv.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding-left:8px;';
      item.missingDays.forEach(function(dateStr) {
        var daySpan = document.createElement('span');
        daySpan.style.cssText = 'padding:4px 10px;background:#fff;border:1px solid #fcd34d;border-radius:14px;' +
          'cursor:pointer;font-size:12px;color:#92400e;transition:all 0.15s ease;' +
          'white-space:nowrap;';
        daySpan.textContent = formatDate(dateStr);
        daySpan.title = 'Click để chấm công ngày ' + formatDate(dateStr) + ' cho ' + cleanEmployeeName(item.name);
        daySpan.onmouseenter = function() {
          this.style.background = '#fef3c7';
          this.style.borderColor = '#f59e0b';
          this.style.transform = 'translateY(-1px)';
        };
        daySpan.onmouseleave = function() {
          this.style.background = '#fff';
          this.style.borderColor = '#fcd34d';
          this.style.transform = 'translateY(0)';
        };
        daySpan.onclick = function() {
          var dateInput = document.getElementById('attDate');
          if (dateInput) dateInput.value = dateStr;
          if (!isEmployeeSelected(item.name)) {
            addSelectedEmployee(item.name);
          }
          var form = document.getElementById('attendanceForm');
          if (form) {
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          daySpan.style.background = '#fde68a';
          setTimeout(function() { daySpan.style.background = '#fff'; }, 500);
        };
        daysDiv.appendChild(daySpan);
      });
      empDiv.appendChild(daysDiv);
      listEl.appendChild(empDiv);
    });
  }
}

// ==================== STATISTICS FUNCTIONS ====================
function renderStatistics() {
  var rec = L(REC_KEY, []);
  var el = document.getElementById('statsContent');
  if (!el) return;
  if (!rec.length) { el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">📊 Chưa có dữ liệu chấm công</div>'; return; }
  window._statsData = rec;

  var html = '';
  html += '<div class="sub-tabs">';
  html += '<button class="sub-tab active" onclick="switchSubTab(\'dashboard\')"style="font-size:13px">Tổng Quan</button>';
  html += '<button class="sub-tab" onclick="switchSubTab(\'shift-detail\')"style="font-size:13px"">Theo Ca</button>';
  html += '<button class="sub-tab" onclick="switchSubTab(\'task-detail\')"style="font-size:13px">Theo CĐ</button>';
  html += '<button class="sub-tab" onclick="switchSubTab(\'double-shift\')"style="font-size:13px">Tăng ca</button>';
  html += '</div>';

  // Dashboard tab
  html += '<div id="subTabDashboard">';
  html += '<div class="sub-tab-content-frame">';
  html += '<div class="filter-period-row" id="filterPeriodRow">';
  html += '<button class="filter-period-btn active" data-period="all" onclick="setFilterPeriod(\'all\')">📅 Tất cả</button>';
  html += '<button class="filter-period-btn" data-period="week" onclick="setFilterPeriod(\'week\')">📅 Tuần</button>';
  html += '<button class="filter-period-btn" data-period="month" onclick="setFilterPeriod(\'month\')">📅 Tháng</button>';
  html += '<button class="filter-period-btn" data-period="quarter" onclick="setFilterPeriod(\'quarter\')">📅 Quý</button>';
  html += '</div>';
  html += '<div class="filter-person-row">';
  html += '<div class="input-with-clear" style="flex:1;">';
  html += '<input type="text" id="statsEmpInput" placeholder="👤 Nhập tên nhân viên..." autocomplete="off" />';
  html += '<button type="button" class="clear-btn" id="statsClearBtn" onclick="clearStatsInput()" title="Xóa tên">✕</button>';
  html += '<div id="statsEmpAutocomplete" class="autocomplete-list"></div>';
  html += '</div>';
  html += '<select id="statsShiftFilter" onchange="applyStatsFilters()"><option value="">🕐 Tất cả ca</option>';
  shifts.forEach(function(s) { html += '<option value="' + s.name + '">' + s.name + '</option>'; });
  html += '</select></div>';
  html += '<div class="filter-task-row"><select id="statsTaskFilter" onchange="applyStatsFilters()"><option value="">📋 Tất cả công việc</option>';
  var allTasks = new Set();
  rec.forEach(function(r) { (r.tasks || []).forEach(function(t) { allTasks.add(t.task); }); });
  allTasks.forEach(function(task) { html += '<option value="' + task + '">' + task + '</option>'; });
  html += '</select></div>';
  html += '<div id="heatmapRangeInfo" class="heatmap-range-info" style="display:none;"></div>';
  html += '<div style="background:#fff; border:1px solid #e5e7eb; border-radius:12px; padding:16px; margin-bottom:14px;">';
  html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;"><button class="btn btn-xs" onclick="changeHeatmapMonth(-1)">◀</button><span id="heatmapTitle" style="font-weight:700; font-size:15px;"></span><button class="btn btn-xs" onclick="changeHeatmapMonth(1)">▶</button></div>';
  html += '<div id="heatmapGrid" style="display:grid; grid-template-columns:repeat(7,1fr); gap:4px; text-align:center;"></div>';
  html += '<div style="display:flex; align-items:center; gap:8px; margin-top:8px; font-size:11px; color:#6b7280;"><span>Ít</span><div style="width:16px;height:16px;background:#e0f2fe;border-radius:4px;"></div><div style="width:16px;height:16px;background:#7dd3fc;border-radius:4px;"></div><div style="width:16px;height:16px;background:#2563eb;border-radius:4px;"></div><span>Nhiều</span></div>';
  html += '</div>';

  var totalRecords = rec.length,
    uniqueEmployees = new Set(rec.map(function(r) { return r.employee; })).size;
  var eatCount = rec.filter(function(r) { return r.eat === 'Có'; }).length;
  var totalHours = rec.reduce(function(sum, r) { return sum + getShiftHours(r.shift); }, 0);
  var daysSet = new Set(rec.map(function(r) { return r.date; }));
  var avgHoursPerDay = daysSet.size > 0 ? (totalHours / daysSet.size).toFixed(1) : 0;

  html += '<div class="stat-dashboard">';
  html += '<div class="stat-card-enhanced"><span class="stat-icon">📋</span><div class="stat-number">' + totalRecords + '</div><div class="stat-label">Tổng bản ghi</div></div>';
  html += '<div class="stat-card-enhanced"><span class="stat-icon">👤</span><div class="stat-number">' + uniqueEmployees + '</div><div class="stat-label">Nhân viên</div></div>';
  html += '<div class="stat-card-enhanced"><span class="stat-icon">🍚</span><div class="stat-number">' + eatCount + '</div><div class="stat-label">Ăn cơm (' + (totalRecords ? Math.round(eatCount / totalRecords * 100) : 0) + '%)</div></div>';
  html += '<div class="stat-card-enhanced"><span class="stat-icon">⏱️</span><div class="stat-number">' + totalHours + 'h</div><div class="stat-label">Tổng giờ công' + (avgHoursPerDay ? ' (~' + avgHoursPerDay + 'h/ngày)' : '') + '</div></div>';
  html += '</div>';

  html += '<div class="chart-container" style="grid-column: 1 / -1;"><div class="chart-title">📊 Phân bố ca làm việc</div><div id="pieChart" class="pie-chart-wrapper"></div></div>';
  html += '<div id="statsTableContainer"></div>';

  var insightHtml = generateInsights(rec);
  if (insightHtml) html += insightHtml;
  html += '<div style="display:none;gap:6px;margin-top:10px;flex-wrap:wrap" id="adminActionBtns"><button class="btn btn-sm" onclick="exportStatsCSV()">📊 Xuất CSV</button><button class="btn btn-sm btn-primary" onclick="exportStatsPDF()">📄 Xuất PDF</button><button class="btn btn-sm btn-danger" onclick="clearAllRecords()">🗑 Xóa tất cả</button></div>';
  html += '</div>';
  html += '</div>';

  // Shift detail tab
  html += '<div id="subTabShiftDetail" style="display:none;">';
  html += '<div class="sub-tab-content-frame"><h3>🕐 Bảng xếp hạng nhân viên theo ca</h3>';
  html += '<div class="filter-row"><input type="month" id="shiftDetailMonth" style="flex:1;max-width:250px;" /></div>';
  html += '<div style="margin-bottom:10px;"><b>📌 Chọn ca:</b></div>';
  html += '<div id="shiftCheckboxList" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px;">';
  shifts.forEach(function(s, i) {
    html += '<label style="padding:8px 12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;cursor:pointer;font-size:13px;"><input type="checkbox" class="shift-checkbox" value="' + s.name + '" style="margin-right:4px;" />' + (s.icon || '🔹') + ' ' + s.name + '</label>';
  });
  html += '</div>';
  html += '<div style="margin-bottom:12px;"><button class="btn btn-xs" onclick="document.querySelectorAll(\'.shift-checkbox\').forEach(function(c){c.checked=true;})">✅ Chọn tất cả</button> <button class="btn btn-xs" onclick="document.querySelectorAll(\'.shift-checkbox\').forEach(function(c){c.checked=false;})">❌ Bỏ tất cả</button></div>';
  html += '<button class="btn btn-primary" onclick="loadShiftRanking()">🔍 Xem kết quả</button>';
  html += '<div id="shiftRankingResult" style="margin-top:10px;"></div>';
  html += '</div></div>';

  // Task detail tab
  html += '<div id="subTabTaskDetail" style="display:none;">';
  html += '<div class="sub-tab-content-frame"><h3>📋 Thống kê theo công đoạn</h3>';
  html += '<div class="filter-row" style="align-items:center;gap:10px;">';
  html += '<select id="taskDetailSelect" style="flex:2;"><option value="">-- Chọn công đoạn --</option>';
  var allTasksForSelect = new Set();
  rec.forEach(function(r) { (r.tasks || []).forEach(function(t) { allTasksForSelect.add(t.task); }); });
  allTasksForSelect.forEach(function(task) { html += '<option value="' + task + '">' + task + '</option>'; });
  html += '</select>';
  html += '<input type="month" id="taskDetailMonth" style="max-width:140px; flex:0 0 auto;" />';
  html += '<button class="btn btn-primary btn-sm" onclick="loadTaskDetail()">🔍 Xem</button>';
  html += '</div>';
  html += '<div id="taskDetailResult" style="margin-top:10px;">';
  html += '<div id="winnerContainer"></div>';
  html += '<div id="taskRanking" style="margin-bottom:16px;"></div>';
  html += '<div id="taskDetailTable" style="overflow-x:auto;"></div>';
  html += '</div></div></div>';

  // Overtime tab
  html += '<div id="subTabOvertime" style="display:none;">';
  html += '<div class="card" style="margin-bottom:16px;">';
  html += '<h3>📈 Thống kê tăng ca</h3>';
  html += '<p style="color:#64748b; font-size:13px; margin:0 0 12px 0;">';
  html += '👉 Nhân viên làm từ <strong>2 ca trở lên</strong> trong cùng một ngày được tính là tăng ca';
  html += '</p>';
  html += '<div class="filter-row" style="gap:8px; align-items:center; flex-wrap:wrap;">';
  html += '<label style="font-weight:500; font-size:14px; white-space:nowrap;">📅 Chọn tháng:</label>';
  html += '<input type="month" id="overtimeMonth" title="Chọn tháng thống kê" style="flex:1; max-width:200px;" />';
  html += '<button class="btn btn-primary btn-sm" onclick="loadDoubleShiftRanking()" style="min-width:90px;">🔍 Thống kê</button>';
  html += '<button class="btn btn-sm" onclick="exportDoubleShiftCSV()" style="min-width:100px; background:#10b981; color:white; border:none;">📥 Xuất CSV</button>';
  html += '</div>';
  html += '</div>';
  html += '<div id="overtimeSummary" style="margin-bottom:16px;"></div>';
  html += '<div id="overtimeRanking" style="margin-bottom:16px;"></div>';
  html += '<div id="overtimeDetail"></div>';
  html += '</div>';

  el.innerHTML = html;
  initStatsAutocomplete();
  if (statsFilterState.fromDate) heatmapRange.start = statsFilterState.fromDate;
  if (statsFilterState.toDate) heatmapRange.end = statsFilterState.toDate;
  applyStatsFilters();
  var today = new Date();
  var monthInput = document.getElementById('taskDetailMonth');
  if (monthInput) monthInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var shiftMonthInput = document.getElementById('shiftDetailMonth');
  if (shiftMonthInput) shiftMonthInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
  var overtimeMonthInput = document.getElementById('overtimeMonth');
  if (overtimeMonthInput) overtimeMonthInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
}

// ==================== STATISTICS FILTER FUNCTIONS ====================
function initStatsAutocomplete() {
  var input = document.getElementById('statsEmpInput');
  var autocomplete = document.getElementById('statsEmpAutocomplete');
  if (!input || !autocomplete) return;
  var newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  input = newInput;
  autocomplete = document.getElementById('statsEmpAutocomplete');
  input.addEventListener('input', function() {
    var val = this.value.trim();
    autocomplete.innerHTML = '';
    if (!val) {
      autocomplete.style.display = 'none';
      applyStatsFilters();
      return;
    }
    var matches = [];
    var visibleEmp = getVisibleEmployees();
    visibleEmp.forEach(function(e) {
      var cleanName = cleanEmployeeName(e.name);
      if (containsExactChars(cleanName, val) || containsExactChars(e.name, val)) matches.push(e);
    });
    matches.sort(function(a, b) { return removeAccents(cleanEmployeeName(a.name)).localeCompare(removeAccents(cleanEmployeeName(b.name))); });
    if (matches.length === 0) {
      autocomplete.innerHTML = '<div class="autocomplete-no-result">🔍 Không tìm thấy nhân viên</div>';
      autocomplete.style.display = 'block';
      return;
    }
    matches.slice(0, 8).forEach(function(e) {
      var div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.innerHTML = '<span style="margin-right:6px;">👤</span><span style="flex:1;">' + cleanEmployeeName(e.name) + '</span>';
      div.addEventListener('click', function() {
        input.value = cleanEmployeeName(e.name);
        autocomplete.style.display = 'none';
        applyStatsFilters();
      });
      autocomplete.appendChild(div);
    });
    autocomplete.style.display = 'block';
  });
  input.addEventListener('blur', function() {
    setTimeout(function() {
      if (!autocomplete.contains(document.activeElement) && document.activeElement !== input) autocomplete.style.display = 'none';
    }, 200);
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      autocomplete.style.display = 'none';
      this.blur();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      var items = autocomplete.querySelectorAll('.autocomplete-item');
      if (items.length > 0) items[0].click();
      else applyStatsFilters();
    }
  });
  document.addEventListener('click', function(e) {
    if (e.target !== input && !autocomplete.contains(e.target)) autocomplete.style.display = 'none';
  });
  input.addEventListener('input', function() {
    toggleClearButton('statsEmpInput', 'statsClearBtn');
  });
  setTimeout(function() {
    toggleClearButton('statsEmpInput', 'statsClearBtn');
  }, 100);
}

function toggleClearButton(inputId, btnId) {
  var input = document.getElementById(inputId);
  var btn = document.getElementById(btnId);
  if (input && btn) {
    if (input.value.trim().length > 0) {
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
    }
  }
}

window.clearStatsInput = function() {
  var input = document.getElementById('statsEmpInput');
  if (input) {
    input.value = '';
    input.focus();
    var clearBtn = document.getElementById('statsClearBtn');
    if (clearBtn) clearBtn.classList.remove('show');
    applyStatsFilters();
  }
};

function setFilterPeriod(period) {
  statsFilterState.period = period;
  document.querySelectorAll('.filter-period-btn').forEach(function(btn) { btn.classList.remove('active'); });
  var activeBtn = document.querySelector('.filter-period-btn[data-period="' + period + '"]');
  if (activeBtn) activeBtn.classList.add('active');
  var now = new Date();
  var fromDate = '',
    toDate = now.toISOString().split('T')[0];
  if (period === 'week') {
    var startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1);
    fromDate = startOfWeek.toISOString().split('T')[0];
  } else if (period === 'month') {
    fromDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  } else if (period === 'quarter') {
    var quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    fromDate = new Date(now.getFullYear(), quarterMonth, 1).toISOString().split('T')[0];
  } else {
    fromDate = '';
    toDate = '';
  }
  heatmapRange.start = fromDate;
  heatmapRange.end = toDate || fromDate;
  statsFilterState.fromDate = fromDate;
  statsFilterState.toDate = toDate;
  applyStatsFilters();
}

function applyStatsFilters() {
  var rec = window._statsData || [];
  var fromDate = heatmapRange.start || '',
    toDate = heatmapRange.end || heatmapRange.start || '';
  var empFilter = document.getElementById('statsEmpInput')?.value?.trim() || '';
  var shiftFilter = document.getElementById('statsShiftFilter')?.value || '';
  var taskFilter = document.getElementById('statsTaskFilter')?.value || '';
  statsFilterState.fromDate = fromDate;
  statsFilterState.toDate = toDate;
  statsFilterState.employee = empFilter;
  statsFilterState.shift = shiftFilter;
  statsFilterState.task = taskFilter;

  var filtered = rec;
  if (fromDate) filtered = filtered.filter(function(r) { return r.date >= fromDate; });
  if (toDate) filtered = filtered.filter(function(r) { return r.date <= toDate; });
  if (shiftFilter) filtered = filtered.filter(function(r) { return r.shift && r.shift.startsWith(shiftFilter); });
  if (taskFilter) filtered = filtered.filter(function(r) { return (r.tasks || []).some(function(t) { return t.task === taskFilter; }); });
  if (empFilter) {
    var empRecords = filtered.filter(function(r) {
      return removeAccents(cleanEmployeeName(r.employee).toLowerCase()) === removeAccents(empFilter.toLowerCase()) ||
        removeAccents(r.employee.toLowerCase()) === removeAccents(empFilter.toLowerCase());
    });
    if (empRecords.length > 0) {
      var workKeys = new Set();
      empRecords.forEach(function(r) {
        var taskNames = (r.tasks || []).map(function(t) { return t.task; }).sort().join(',');
        var key = r.date + '|' + (r.shift || '') + '|' + taskNames;
        workKeys.add(key);
      });
      filtered = filtered.filter(function(r) {
        var taskNames = (r.tasks || []).map(function(t) { return t.task; }).sort().join(',');
        var key = r.date + '|' + (r.shift || '') + '|' + taskNames;
        return workKeys.has(key);
      });
    } else { filtered = []; }
  }

  var totalRecords = filtered.length,
    uniqueEmployees = new Set(filtered.map(function(r) { return r.employee; })).size;
  var eatCount = filtered.filter(function(r) { return r.eat === 'Có'; }).length;
  var totalHours = filtered.reduce(function(sum, r) { return sum + getShiftHours(r.shift); }, 0);
  var daysSet = new Set(filtered.map(function(r) { return r.date; }));
  var avgHoursPerDay = daysSet.size > 0 ? (totalHours / daysSet.size).toFixed(1) : 0;

  var cards = document.querySelectorAll('#subTabDashboard .stat-card-enhanced .stat-number');
  if (cards.length >= 4) {
    cards[0].textContent = formatNumber(totalRecords);
    cards[1].textContent = formatNumber(uniqueEmployees);
    cards[2].textContent = formatNumber(eatCount) + ' (' + (totalRecords ? Math.round(eatCount / totalRecords * 100) : 0) + '%)';
    cards[3].innerHTML = formatNumber(totalHours) + 'h <span style="font-size:11px;color:#64748b;">(~' + avgHoursPerDay + 'h/ngày)</span>';
  }

  var monthNames = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];
  var titleEl = document.getElementById('heatmapTitle');
  if (titleEl) titleEl.textContent = monthNames[heatmapState.month - 1] + ' ' + heatmapState.year;

  renderHeatmap(filtered);
  renderCharts(filtered);
  renderStatsTable(filtered);

  var insightBox = document.querySelector('#subTabDashboard .insight-box');
  if (insightBox) {
    var newInsight = generateInsights(filtered);
    if (newInsight) insightBox.outerHTML = newInsight;
    else insightBox.outerHTML = '';
  }
}

// ==================== HEATMAP FUNCTIONS ====================
function renderHeatmap(filteredRecords) {
  var grid = document.getElementById('heatmapGrid');
  if (!grid) return;
  var year = heatmapState.year,
    month = heatmapState.month;
  var firstDay = new Date(year, month - 1, 1).getDay(),
    daysInMonth = new Date(year, month, 0).getDate();
  var startDay = (firstDay + 6) % 7;
  var dateCount = {};
  filteredRecords.forEach(function(r) { dateCount[r.date] = (dateCount[r.date] || 0) + 1; });
  var maxCount = Math.max.apply(null, Object.values(dateCount).concat([1]));
  var html = '',
    dayHeaders = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  dayHeaders.forEach(function(d) { html += '<div style="font-weight:600;color:#6b7280;font-size:11px;">' + d + '</div>'; });
  for (var i = 0; i < startDay; i++) html += '<div></div>';
  var today = new Date();
  for (var day = 1; day <= daysInMonth; day++) {
    var dateStr = year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var count = dateCount[dateStr] || 0,
      intensity = maxCount > 0 ? count / maxCount : 0;
    var bgColor = count === 0 ? '#f1f5f9' : intensity < 0.3 ? '#e0f2fe' : intensity < 0.6 ? '#7dd3fc' : '#2563eb';
    var textColor = intensity > 0.5 ? '#fff' : '#0b1220';
    var isToday = (today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === day);
    var inRange = false;
    if (heatmapRange.start && heatmapRange.end) inRange = (dateStr >= heatmapRange.start && dateStr <= heatmapRange.end);
    var extraStyle = '';
    if (dateStr === heatmapRange.start) extraStyle = 'box-shadow: 0 0 0 3px #f59e0b;';
    else if (dateStr === heatmapRange.end) extraStyle = 'box-shadow: 0 0 0 3px #10b981;';
    if (inRange) { bgColor = '#93c5fd';
      textColor = '#1e3a8a'; }
    html += '<div class="heatmap-cell" data-date="' + dateStr + '" style="aspect-ratio:1; background:' + bgColor + '; color:' + textColor + '; border-radius:5px; display:flex; align-items:center; justify-content:center; font-size:13px; cursor:pointer; border:' + (isToday ? '2px solid #0f172a' : '1px solid transparent') + '; ' + extraStyle + '" onclick="handleHeatmapClick(\'' + dateStr + '\', event)">' + day + '</div>';
  }
  grid.innerHTML = html;
  updateRangeInfoDisplay();
}

window.handleHeatmapClick = function(dateStr, event) {
  if (!heatmapRange.start || (heatmapRange.start && heatmapRange.end)) {
    heatmapRange.start = dateStr;
    heatmapRange.end = null;
  } else {
    if (dateStr < heatmapRange.start) {
      heatmapRange.end = heatmapRange.start;
      heatmapRange.start = dateStr;
    } else {
      heatmapRange.end = dateStr;
    }
  }
  statsFilterState.fromDate = heatmapRange.start;
  statsFilterState.toDate = heatmapRange.end || heatmapRange.start;
  applyStatsFilters();
};

function updateRangeInfoDisplay() {
  var infoEl = document.getElementById('heatmapRangeInfo');
  if (!infoEl) return;
  if (heatmapRange.start) {
    infoEl.style.display = 'flex';
    infoEl.innerHTML = '📅 Đã chọn: <strong>' + formatDate(heatmapRange.start) + ' → ' + formatDate(heatmapRange.end || heatmapRange.start) + '</strong> <button onclick="clearHeatmapRange()">✕ Xóa</button>';
  } else {
    infoEl.style.display = 'none';
    infoEl.innerHTML = '';
  }
}

window.clearHeatmapRange = function() {
  heatmapRange.start = null;
  heatmapRange.end = null;
  statsFilterState.fromDate = '';
  statsFilterState.toDate = '';
  document.querySelectorAll('.filter-period-btn').forEach(function(btn) { btn.classList.remove('active'); });
  var allBtn = document.querySelector('.filter-period-btn[data-period="all"]');
  if (allBtn) allBtn.classList.add('active');
  statsFilterState.period = 'all';
  applyStatsFilters();
};

window.changeHeatmapMonth = function(delta) {
  var newMonth = heatmapState.month + delta,
    newYear = heatmapState.year;
  if (newMonth < 1) { newMonth = 12;
    newYear--; }
  if (newMonth > 12) { newMonth = 1;
    newYear++; }
  heatmapState.year = newYear;
  heatmapState.month = newMonth;
  applyStatsFilters();
};

// ==================== CHART FUNCTIONS ====================
function renderCharts(records) {
  if (!records.length) {
    document.getElementById('pieChart').innerHTML = '<div class="muted" style="text-align:center;padding:20px">Không có dữ liệu</div>';
    return;
  }
  var shiftData = {};
  records.forEach(function(r) {
    var shiftName = r.shift ? r.shift.split('(')[0].trim() : 'Khác';
    shiftData[shiftName] = (shiftData[shiftName] || 0) + 1;
  });
  var sorted = Object.entries(shiftData).sort(function(a, b) { return b[1] - a[1]; });
  var total = sorted.reduce(function(s, item) { return s + item[1]; }, 0);
  var maxVal = sorted.length > 0 ? sorted[0][1] : 1;
  var colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#6366f1'];
  var html = '<div style="padding:8px 0;">';
  sorted.forEach(function(item, idx) {
    var name = item[0],
      count = item[1];
    var percent = Math.round((count / total) * 100);
    var barWidth = Math.max(Math.round((count / maxVal) * 100), 15);
    var color = colors[idx % colors.length];
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">';
    html += '<div style="min-width:55px;font-size:13px;font-weight:600;text-align:right;">' + name + '</div>';
    html += '<div style="flex:1;background:#f1f5f9;border-radius:8px;height:28px;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,0.1);">';
    html += '<div style="background:' + color + ';height:100%;width:' + barWidth + '%;border-radius:8px;display:flex;align-items:center;justify-content:flex-end;padding-right:10px;transition:width 0.5s ease;min-width:40px;">';
    html += '<span style="color:white;font-weight:700;font-size:13px;text-shadow:0 1px 2px rgba(0,0,0,0.2);">' + count + '</span>';
    html += '</div></div>';
    html += '<div style="min-width:45px;font-size:13px;font-weight:600;color:' + color + ';">' + percent + '%</div>';
    html += '</div>';
  });
  html += '<div style="text-align:center;font-size:12px;color:#64748b;margin-top:8px;">📊 Tổng: <strong>' + total + '</strong> bản ghi</div>';
  html += '</div>';
  document.getElementById('pieChart').innerHTML = html;
}

// ==================== STATS TABLE FUNCTIONS ====================
function renderStatsTable(records) {
  var container = document.getElementById('statsTableContainer');
  if (!container) return;
  if (!records.length) {
    container.innerHTML = '<div class="muted" style="text-align:center;padding:16px">Không có bản ghi phù hợp</div>';
    return;
  }
  _tableGroupIndex = 0;
  _tableGroupMap = {};
  var grouped = {};
  records.forEach(function(record) {
    var key = record.date + '|' + (record.shift || '') + '|' + (record.eat || '') + '|' + (record.note || '') + '|' + JSON.stringify(record.tasks || []);
    if (!grouped[key]) {
      grouped[key] = {
        date: record.date,
        shift: record.shift,
        eat: record.eat,
        note: record.note,
        tasks: record.tasks || [],
        employees: [],
        firstTimestamp: record.timestamp || '9999'
      };
    }
    var cleanName = cleanEmployeeName(record.employee);
    if (grouped[key].employees.indexOf(cleanName) === -1) {
      grouped[key].employees.push(cleanName);
    }
    if (record.timestamp && record.timestamp < grouped[key].firstTimestamp) {
      grouped[key].firstTimestamp = record.timestamp;
    }
  });
  var sortedKeys = Object.keys(grouped);
  sortedKeys.sort(function(a, b) {
    var groupA = grouped[a];
    var groupB = grouped[b];
    if (groupA.date !== groupB.date) return groupA.date.localeCompare(groupB.date);
    var shiftNameA = groupA.shift ? groupA.shift.split('(')[0].trim() : '';
    var shiftNameB = groupB.shift ? groupB.shift.split('(')[0].trim() : '';
    var order = ['Ca 1', 'Ca 2', 'Ca 3', 'HC', '1/2 Ca', 'Nghỉ'];
    var orderA = order.indexOf(shiftNameA);
    var orderB = order.indexOf(shiftNameB);
    if (orderA === -1) orderA = 99;
    if (orderB === -1) orderB = 99;
    if (orderA !== orderB) return orderA - orderB;
    if (window._manualSort) return 0;
    return (groupA.firstTimestamp || '99').localeCompare(groupB.firstTimestamp || '99');
  });
  var allGroups = sortedKeys.map(function(key) {
    return { key: key, data: grouped[key] };
  });
  PaginationManager.overview.data = allGroups;
  PaginationManager.overview.currentPage = 1;
  renderCurrentOverviewPage(container);
}

function renderCurrentOverviewPage(container) {
  var state = PaginationManager.overview;
  var startIdx = (state.currentPage - 1) * state.itemsPerPage;
  var endIdx = Math.min(startIdx + state.itemsPerPage, state.data.length);
  var pageData = state.data.slice(startIdx, endIdx);
  var html = '<div style="overflow-x:auto"><table class="stats-table-compact">';
  html += '<tr><th>STT</th><th>Ngày</th><th>Nhân viên</th><th>Ca làm</th><th>Công việc</th><th>Ghi chú</th><th>Ăn</th><th style="width:110px">Thao tác</th></tr>';
  pageData.forEach(function(item, idx) {
    var globalIdx = startIdx + idx;
    var group = item.data;
    var dataIndex = 'gidx_' + (globalIdx + 1);
    _tableGroupMap[dataIndex] = item.key;
    var shiftName = group.shift ? group.shift.split('(')[0].trim() : '-';
    var tasks = group.tasks.length ? group.tasks.map(function(t) { return t.task; }).join(', ') : '-';
    var noteText = group.note || '-';
    var noteSafe = escHtml(noteText);
    var eatBadge = group.eat === 'Có' ? 'yes' : 'no';
    var employeeTags = '';
    group.employees.forEach(function(empName) {
      employeeTags += '<span class="emp-tag">' + escHtml(cleanEmployeeName(empName)) + '</span> ';
    });
    html += '<tr draggable="true" ' +
      'ondragstart="onRowDragStart(event)" ' +
      'ondragover="onRowDragOver(event)" ' +
      'ondrop="onRowDrop(event)" ' +
      'data-gidx="' + dataIndex + '">' +
      '<td>' + (globalIdx + 1) + '</td>' +
      '<td class="date-compact">' + formatDate(group.date) + '</td>' +
      '<td><div class="employee-group">' + employeeTags + '</div></td>' +
      '<td><span class="shift-badge ' + getShiftColorClass(shiftName) + '">' + escHtml(shiftName) + '</span></td>' +
      '<td class="task-list-compact">' + highlightTruongCa(tasks) + '</td>' +
      '<td class="note-cell" onclick="expandNote(event)" title="Bấm để xem đầy đủ">' + noteSafe + '</td>' +
      '<td><span class="eat-badge ' + eatBadge + '">' + (group.eat || '-') + '</span></td>' +
      '<td><div class="actions" style="gap:4px; justify-content:center;">' +
      (isAdmin ?
        '<button class="btn btn-xs btn-primary btn-edit-group" data-gidx="' + dataIndex + '" title="Sửa nhóm">✏️</button>' +
        '<button class="btn btn-xs btn-danger btn-del-group" data-gidx="' + dataIndex + '" title="Xóa nhóm">🗑</button>' +
        '<button class="btn btn-xs" onclick="moveGroupUp(\'' + dataIndex + '\')" title="Lên">▲</button>' +
        '<button class="btn btn-xs" onclick="moveGroupDown(\'' + dataIndex + '\')" title="Xuống">▼</button>' :
        '<span style="color:#94a3b8; font-size:11px;">🔒</span>') +
      '</div></td></tr>';
  });
  html += '</table></div>';
  html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#64748b;">';
  html += '<span>Hiển thị ' + (startIdx + 1) + '-' + endIdx + ' / ' + state.data.length + ' nhóm</span>';
  html += '<span>Trang ' + state.currentPage + ' / ' + Math.ceil(state.data.length / state.itemsPerPage) + '</span>';
  html += '</div>';
  html += buildPaginationControls('overview');
  container.innerHTML = html;
  container.querySelectorAll('.btn-del-group').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var key = _tableGroupMap[this.getAttribute('data-gidx')];
      if (key) deleteRecordGroup(key);
    });
  });
  container.querySelectorAll('.btn-edit-group').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var key = _tableGroupMap[this.getAttribute('data-gidx')];
      if (key) openEditModal(key);
    });
  });
}

function buildPaginationControls(tableType) {
  var state = PaginationManager[tableType];
  var totalPages = Math.ceil(state.data.length / state.itemsPerPage);
  if (totalPages <= 1) return '';
  var html = '<div class="pagination-controls">';
  html += '<button class="btn btn-xs" onclick="goToPage(\'' + tableType + '\', 1)" ' +
    (state.currentPage === 1 ? 'disabled' : '') + '>«</button>';
  html += '<button class="btn btn-xs" onclick="goToPage(\'' + tableType + '\', ' + (state.currentPage - 1) + ')" ' +
    (state.currentPage === 1 ? 'disabled' : '') + '>‹</button>';
  var startPage = Math.max(1, state.currentPage - 2);
  var endPage = Math.min(totalPages, startPage + 4);
  startPage = Math.max(1, endPage - 4);
  for (var i = startPage; i <= endPage; i++) {
    if (i === state.currentPage) {
      html += '<button class="btn btn-xs btn-primary" style="font-weight:700;min-width:32px;">' + i + '</button>';
    } else {
      html += '<button class="btn btn-xs" onclick="goToPage(\'' + tableType + '\', ' + i + ')" style="min-width:32px;">' + i + '</button>';
    }
  }
  html += '<button class="btn btn-xs" onclick="goToPage(\'' + tableType + '\', ' + (state.currentPage + 1) + ')" ' +
    (state.currentPage === totalPages ? 'disabled' : '') + '>›</button>';
  html += '<button class="btn btn-xs" onclick="goToPage(\'' + tableType + '\', ' + totalPages + ')" ' +
    (state.currentPage === totalPages ? 'disabled' : '') + '>»</button>';
  html += '<select onchange="changeItemsPerPage(\'' + tableType + '\', this.value)" style="padding:4px 8px;border:1px solid #e5e7eb;border-radius:6px;font-size:12px;cursor:pointer;background:white;">';
  [10, 20, 30, 50, 100].forEach(function(num) {
    html += '<option value="' + num + '" ' + (state.itemsPerPage === num ? 'selected' : '') + '>' + num + ' dòng</option>';
  });
  html += '</select>';
  html += '</div>';
  return html;
}

window.goToPage = function(tableType, page) {
  var state = PaginationManager[tableType];
  var totalPages = Math.ceil(state.data.length / state.itemsPerPage);
  if (page < 1 || page > totalPages) return;
  state.currentPage = page;
  if (tableType === 'overview') {
    var container = document.getElementById('statsTableContainer');
    if (container) renderCurrentOverviewPage(container);
  } else if (tableType === 'taskDetail') {
    var container = document.getElementById('taskDetailTable');
    if (container) renderCurrentTaskDetailPage(container);
  }
};

window.changeItemsPerPage = function(tableType, value) {
  var state = PaginationManager[tableType];
  state.itemsPerPage = parseInt(value);
  state.currentPage = 1;
  if (tableType === 'overview') {
    var container = document.getElementById('statsTableContainer');
    if (container) renderCurrentOverviewPage(container);
  } else if (tableType === 'taskDetail') {
    var container = document.getElementById('taskDetailTable');
    if (container) renderCurrentTaskDetailPage(container);
  }
};

window.expandNote = function(event) {
  event.currentTarget.classList.toggle('expanded');
};

// ==================== INSIGHT FUNCTIONS ====================
function generateInsights(records) {
  if (records.length < 1) return '';
  var dailyCounts = {};
  records.forEach(function(r) { dailyCounts[r.date] = (dailyCounts[r.date] || 0) + 1; });
  var sortedDays = Object.keys(dailyCounts).sort(function(a, b) { return dailyCounts[b] - dailyCounts[a]; });
  var busiestDay = sortedDays[0] ? formatDate(sortedDays[0]) : 'Chưa có';
  var busiestCount = sortedDays[0] ? dailyCounts[sortedDays[0]] : 0;
  var eatPercent = records.length > 0 ? Math.round(records.filter(function(r) { return r.eat === 'Có'; }).length / records.length * 100) : 0;
  return '<div class="insight-box"><div class="insight-icon">💡</div><div class="insight-text"><strong>📊 Phân tích:</strong> 📅 Ngày đông nhất: <strong>' + busiestDay + '</strong> (' + busiestCount + ' bản ghi) | 🍚 Tỉ lệ ăn cơm: <strong>' + eatPercent + '%</strong></div></div>';
}

// ==================== SHIFT RANKING FUNCTIONS ====================
window.loadShiftRanking = function() {
  var monthVal = document.getElementById('shiftDetailMonth')?.value;
  if (!monthVal) { showAlert('⚠️ Vui lòng chọn tháng!', 'Thiếu thông tin'); return; }
  var selectedShifts = [];
  document.querySelectorAll('.shift-checkbox:checked').forEach(function(cb) { selectedShifts.push(cb.value); });
  if (selectedShifts.length === 0) { showAlert('⚠️ Vui lòng chọn ít nhất 1 ca!', 'Thiếu thông tin'); return; }
  var allRecords = L(REC_KEY, []);
  var filtered = allRecords.filter(function(r) { return r.date.startsWith(monthVal); });
  if (filtered.length === 0) {
    document.getElementById('shiftRankingResult').innerHTML = '<div class="muted" style="text-align:center;padding:40px;">📊 Không có dữ liệu trong tháng này</div>';
    return;
  }
  var shiftStats = {};
  selectedShifts.forEach(function(shiftName) {
    var shiftInfo = shifts.find(function(s) { return s.name === shiftName; });
    shiftStats[shiftName] = { name: shiftName, icon: shiftInfo ? shiftInfo.icon : '🔹', time: shiftInfo ? shiftInfo.time : '', employees: {} };
    emp.forEach(function(e) {
      var cleanName = cleanEmployeeName(e.name);
      shiftStats[shiftName].employees[cleanName] = 0;
    });
  });
  filtered.forEach(function(r) {
    var shiftName = r.shift ? r.shift.split('(')[0].trim() : 'Khác';
    var empName = cleanEmployeeName(r.employee);
    if (!shiftStats[shiftName]) return;
    if (!shiftStats[shiftName].employees[empName]) shiftStats[shiftName].employees[empName] = 0;
    shiftStats[shiftName].employees[empName]++;
  });
  var html = '';
  var colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6'];
  var colorIndex = 0;
  var sortedShifts = Object.keys(shiftStats).sort(function(a, b) { return getShiftOrder(a) - getShiftOrder(b); });
  sortedShifts.forEach(function(shiftName) {
    var shiftData = shiftStats[shiftName];
    var employees = shiftData.employees;
    var ranking = Object.entries(employees).sort(function(a, b) { return b[1] - a[1]; });
    var totalCount = ranking.reduce(function(sum, item) { return sum + item[1]; }, 0);
    var maxCount = ranking.length > 0 ? ranking[0][1] : 1;
    var color = colors[colorIndex % colors.length];
    colorIndex++;
    html += '<div class="shift-ranking-card" style="margin-bottom:20px; background:white; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.06); overflow:hidden;">';
    html += '<div style="background:linear-gradient(135deg, ' + color + '15, ' + color + '05); border-left:4px solid ' + color + '; padding:15px 20px;">';
    html += '<div style="display:flex; align-items:center; gap:10px;">';
    html += '<span style="font-size:28px;">' + (shiftData.icon || '🔹') + '</span>';
    html += '<div style="flex:1;"><h4 style="margin:0; font-size:18px; font-weight:700; color:#1e293b;">' + shiftData.name + '</h4><span style="font-size:13px; color:#64748b;">' + shiftData.time + '</span></div>';
    html += '<span class="shift-badge ' + getShiftColorClass(shiftData.name) + '" style="font-size:14px; padding:6px 14px;">' + totalCount + ' lượt</span>';
    html += '</div></div>';
    html += '<div style="padding:15px 20px;">';
    if (ranking.length === 0) {
      html += '<div style="text-align:center; padding:20px; color:#94a3b8; font-style:italic;">📭 Chưa có nhân viên nào làm ca này trong tháng</div>';
    } else {
      html += '<div class="shift-ranking-list">';
      ranking.forEach(function(item, idx) {
        var empName = item[0],
          count = item[1],
          percentage = Math.round((count / maxCount) * 100);
        var bgColor = 'white',
          borderColor = '#e5e7eb',
          fontWeight = '400',
          nameColor = '#1e293b';
        if (idx === 0) { bgColor = '#fef3c7';
          borderColor = '#f59e0b';
          fontWeight = '700';
          nameColor = '#92400e'; } else if (idx === 1) { bgColor = '#f1f5f9';
          borderColor = '#94a3b8';
          fontWeight = '600'; } else if (idx === 2) { bgColor = '#fef2f2';
          borderColor = '#fca5a5';
          fontWeight = '600';
          nameColor = '#991b1b'; }
        var rankIcon = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '<span style="color:#64748b; font-weight:600; font-size:14px; min-width:30px; display:inline-block;">' + (idx + 1) + '.</span>';
        var barColors = { 0: '#2563eb', 1: '#059669', 2: '#d97706', 'default': '#6366f1' };
        var barColor = idx === 0 ? barColors[0] : idx === 1 ? barColors[1] : idx === 2 ? barColors[2] : barColors['default'];
        var barGradient = idx === 0 ? 'linear-gradient(90deg, #1d4ed8, #3b82f6)' : idx === 1 ? 'linear-gradient(90deg, #047857, #10b981)' : idx === 2 ? 'linear-gradient(90deg, #b45309, #f59e0b)' : 'linear-gradient(90deg, #4f46e5, #818cf8)';
        html += '<div style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:' + bgColor + '; border:2px solid ' + borderColor + '; border-radius:10px; margin-bottom:8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">';
        html += '<div style="width:35px; text-align:center; font-size:20px;">' + rankIcon + '</div>';
        html += '<div style="flex:1; font-weight:' + fontWeight + '; font-size:15px; color:' + nameColor + ';">' + empName + '</div>';
        html += '<div style="flex:2; background:#e5e7eb; border-radius:12px; height:10px; overflow:hidden; box-shadow:inset 0 2px 4px rgba(0,0,0,0.1);">';
        html += '<div style="background:' + barGradient + '; height:100%; width:' + percentage + '%; border-radius:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div></div>';
        html += '<div style="min-width:50px; text-align:right; font-weight:600; font-size:16px; color:' + barColor + ';">' + count + ' lần</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    html += '</div></div>';
  });
  document.getElementById('shiftRankingResult').innerHTML = html || '<div class="muted" style="text-align:center;padding:40px;">📊 Không có dữ liệu trong tháng này cho các ca đã chọn</div>';
};

// ==================== TASK DETAIL FUNCTIONS ====================
window.loadTaskDetail = function() {
  var task = document.getElementById('taskDetailSelect')?.value;
  var month = document.getElementById('taskDetailMonth')?.value;
  if (!task || !month) { showAlert('Vui lòng chọn công đoạn và tháng!'); return; }
  var allRecords = L(REC_KEY, []);
  var filtered = allRecords.filter(function(r) { return r.tasks && Array.isArray(r.tasks) && r.tasks.some(function(t) { return t.task === task; }) && r.date.startsWith(month); });
  var countMap = {};
  emp.forEach(function(e) { countMap[cleanEmployeeName(e.name)] = 0; });
  filtered.forEach(function(r) {
    var name = cleanEmployeeName(r.employee);
    if (countMap[name] !== undefined) countMap[name]++;
    else countMap[name] = 1;
  });
  var ranking = Object.entries(countMap).filter(function(item) { return item[1] > 0; }).sort(function(a, b) { return b[1] - a[1]; });
  var winner = ranking[0];
  var winnerHtml = '';
  if (winner && winner[1] > 0) {
    winnerHtml = '<div class="winner-box"><span class="winner-icon">🏆</span><div class="winner-label">Người thực hiện nhiều nhất</div><div class="winner-name">' + winner[0] + '</div><div class="winner-count">' + winner[1] + ' lần thực hiện</div></div>';
  } else {
    winnerHtml = '<div class="muted" style="text-align:center;padding:20px;">📊 Chưa có dữ liệu cho công đoạn này</div>';
  }
  document.getElementById('winnerContainer').innerHTML = winnerHtml;
  var rankingHtml = '<h4>📊 Bảng xếp hạng nhân viên</h4>';
  if (ranking.length > 0) {
    rankingHtml += '<div style="max-height:350px; overflow-y:auto;">';
    ranking.forEach(function(item, idx) {
      var name = item[0],
        count = item[1];
      var medal = idx === 0 ? ' 🥇' : idx === 1 ? ' 🥈' : idx === 2 ? ' 🥉' : '';
      var bgColor = idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : idx === 2 ? '#fef2f2' : 'transparent';
      rankingHtml += '<div class="list-item" style="cursor:pointer; background:' + bgColor + '; padding:10px 8px; font-size:14px;" onclick="filterTaskDetailByEmployee(\'' + name.replace(/'/g, "\\'") + '\')"><span style="font-weight:600;">' + (idx + 1) + '. ' + name + medal + '</span><span style="font-weight:700; color:#2563eb;">' + count + ' lần</span></div>';
    });
    rankingHtml += '</div>';
  } else {
    rankingHtml += '<div class="muted" style="text-align:center;padding:20px;">Không có dữ liệu</div>';
  }
  document.getElementById('taskRanking').innerHTML = rankingHtml;
  window._taskDetailAll = filtered;
  renderTaskDetailTable(filtered);
};

window.filterTaskDetailByEmployee = function(empName) {
  var filtered = (window._taskDetailAll || []).filter(function(r) { return cleanEmployeeName(r.employee) === empName; });
  renderTaskDetailTable(filtered);
  document.querySelectorAll('#taskRanking .list-item').forEach(function(item) { item.style.background = 'transparent';
    item.style.fontWeight = 'normal'; });
  var items = document.querySelectorAll('#taskRanking .list-item');
  items.forEach(function(item) {
    if (item.textContent.includes(empName)) { item.style.background = '#eff6ff';
      item.style.fontWeight = 'bold';
      item.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  });
};

function renderTaskDetailTable(records) {
  var grouped = {};
  records.forEach(function(rec) {
    var empName = cleanEmployeeName(rec.employee);
    var shiftName = rec.shift ? rec.shift.split('(')[0].trim() : '-';
    var key = rec.date + '|' + shiftName;
    if (!grouped[key]) {
      grouped[key] = {
        date: rec.date,
        shiftName: shiftName,
        employees: [],
        note: rec.note || ''
      };
    }
    if (grouped[key].employees.indexOf(empName) === -1) {
      grouped[key].employees.push(empName);
    }
    if (rec.note && rec.note.trim() !== '') {
      grouped[key].note = rec.note;
    }
  });
  var groupedArray = Object.values(grouped);
  groupedArray.sort(function(a, b) {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return getShiftOrder(a.shiftName) - getShiftOrder(b.shiftName);
  });
  PaginationManager.taskDetail.data = groupedArray;
  PaginationManager.taskDetail.currentPage = 1;
  var container = document.getElementById('taskDetailTable');
  if (container) renderCurrentTaskDetailPage(container);
}

function renderCurrentTaskDetailPage(container) {
  var state = PaginationManager.taskDetail;
  var startIdx = (state.currentPage - 1) * state.itemsPerPage;
  var endIdx = Math.min(startIdx + state.itemsPerPage, state.data.length);
  var pageData = state.data.slice(startIdx, endIdx);
  var html = '<h4>📋 Chi tiết chấm công</h4>';
  if (pageData.length === 0) {
    html += '<div class="muted" style="text-align:center;padding:20px;">Không có dữ liệu chi tiết</div>';
  } else {
    html += '<div style="overflow-x:auto;"><table class="stats-table-compact">';
    html += '<tr><th>STT</th><th>Ngày</th><th>Ca</th><th>Người thực hiện</th><th>Ghi chú</th></tr>';
    pageData.forEach(function(item, idx) {
      var globalIdx = startIdx + idx;
      var noteStr = item.note || '-';
      var employeeList = '';
      item.employees.forEach(function(emp) {
        employeeList += '<span class="emp-tag">' + escHtml(emp) + '</span> ';
      });
      html += '<tr>' +
        '<td>' + (globalIdx + 1) + '</td>' +
        '<td class="date-compact">' + formatDate(item.date) + '</td>' +
        '<td><span class="shift-badge ' + getShiftColorClass(item.shiftName) + '">' + item.shiftName + '</span></td>' +
        '<td><div class="employee-group">' + employeeList + '</div></td>' +
        '<td class="note-cell-personal" onclick="showNotePopup(event, \'' +
        noteStr.replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')" ' +
        'onmouseenter="showNotePopup(event, \'' +
        noteStr.replace(/'/g, "\\'").replace(/"/g, '&quot;') + '\')" ' +
        'onmouseleave="hideNotePopup()" title="Bấm để xem đầy đủ">' +
        (noteStr.length > 30 ? noteStr.substring(0, 30) + '...' : noteStr) +
        '</td>' +
        '</tr>';
    });
    html += '</table></div>';
    html += '<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:#64748b;">';
    html += '<span>Hiển thị ' + (startIdx + 1) + '-' + endIdx + ' / ' + state.data.length + ' bản ghi</span>';
    html += '<span>Trang ' + state.currentPage + ' / ' + Math.ceil(state.data.length / state.itemsPerPage) + '</span>';
    html += '</div>';
    html += buildPaginationControls('taskDetail');
  }
  container.innerHTML = html;
}

// ==================== OVERTIME FUNCTIONS ====================
window.loadDoubleShiftRanking = function() {
  var monthVal = document.getElementById('overtimeMonth')?.value;
  if (!monthVal) {
    showAlert('⚠️ Vui lòng chọn tháng!', 'Thiếu thông tin');
    return;
  }
  var allRecords = L(REC_KEY, []);
  var monthRecords = allRecords.filter(function(r) {
    return r.date.startsWith(monthVal);
  });
  if (monthRecords.length === 0) {
    document.getElementById('overtimeSummary').innerHTML =
      '<div class="muted" style="text-align:center;padding:40px;">📭 Không có dữ liệu chấm công trong tháng này</div>';
    document.getElementById('overtimeRanking').innerHTML = '';
    document.getElementById('overtimeDetail').innerHTML = '';
    return;
  }
  var dailyMap = {};
  monthRecords.forEach(function(r) {
    var empName = cleanEmployeeName(r.employee);
    var key = empName + '|' + r.date;
    if (!dailyMap[key]) {
      dailyMap[key] = {
        employee: empName,
        date: r.date,
        shifts: [],
        shiftNames: [],
        notes: [],
        recordCount: 0
      };
    }
    var shiftName = r.shift ? r.shift.split('(')[0].trim() : 'Khác';
    dailyMap[key].shifts.push({
      shiftName: shiftName,
      fullShift: r.shift || '',
      eat: r.eat || 'Không',
      note: r.note || '',
      tasks: r.tasks || []
    });
    if (dailyMap[key].shiftNames.indexOf(shiftName) === -1) {
      dailyMap[key].shiftNames.push(shiftName);
    }
    if (r.note && r.note.trim()) {
      dailyMap[key].notes.push(r.note);
    }
    dailyMap[key].recordCount++;
  });
  var doubleShiftEntries = [];
  for (var key in dailyMap) {
    var totalCong = 0;
    dailyMap[key].shiftNames.forEach(function(shiftName) {
      if (shiftName === '1/2 Ca') totalCong += 0.5;
      else if (shiftName === 'Nghỉ') totalCong += 0;
      else totalCong += 1;
    });
    dailyMap[key].totalCong = totalCong;
    if (totalCong > 1) {
      doubleShiftEntries.push(dailyMap[key]);
    }
  }
  var empMap = {};
  doubleShiftEntries.forEach(function(entry) {
    var empName = entry.employee;
    if (!empMap[empName]) {
      empMap[empName] = {
        employee: empName,
        totalDays: 0,
        totalShifts: 0,
        days: []
      };
    }
    empMap[empName].totalDays++;
    empMap[empName].totalShifts += entry.recordCount;
    empMap[empName].days.push({
      date: entry.date,
      shiftNames: entry.shiftNames,
      recordCount: entry.recordCount,
      totalCong: entry.totalCong,
      shifts: entry.shifts
    });
  });
  var ranking = Object.values(empMap).sort(function(a, b) {
    if (b.totalDays !== a.totalDays) return b.totalDays - a.totalDays;
    return b.totalShifts - a.totalShifts;
  });
  window._doubleShiftData = {
    month: monthVal,
    ranking: ranking,
    totalEmployees: ranking.length,
    totalOvertimeDays: doubleShiftEntries.length,
    totalShifts: doubleShiftEntries.reduce(function(s, e) { return s + e.recordCount; }, 0),
    rawEntries: doubleShiftEntries
  };
  renderOvertimeSummary();
  renderDoubleShiftRanking(ranking);
  document.getElementById('overtimeDetail').innerHTML = '';
};

function renderOvertimeSummary() {
  var data = window._doubleShiftData;
  var el = document.getElementById('overtimeSummary');
  if (!el || !data) return;
  if (data.totalEmployees === 0) {
    el.innerHTML = '<div class="muted" style="text-align:center;padding:40px; background:#f0fdf4; border-radius:12px;">' +
      '🎉 <strong>Không có nhân viên nào tăng ca</strong> trong tháng này</div>';
    return;
  }
  var monthDisplay = data.month.split('-')[1] + '/' + data.month.split('-')[0];
  el.innerHTML =
    '<div class="stat-dashboard">' +
    '<div class="stat-card-enhanced" style="border-left: 4px solid #f59e0b;">' +
    '<span class="stat-icon">👥</span>' +
    '<div class="stat-number">' + data.totalEmployees + '</div>' +
    '<div class="stat-label">Nhân viên tăng ca</div>' +
    '</div>' +
    '<div class="stat-card-enhanced" style="border-left: 4px solid #ef4444;">' +
    '<span class="stat-icon">📅</span>' +
    '<div class="stat-number">' + data.totalOvertimeDays + '</div>' +
    '<div class="stat-label">Lượt ngày tăng ca</div>' +
    '</div>' +
    '<div class="stat-card-enhanced" style="border-left: 4px solid #8b5cf6;">' +
    '<span class="stat-icon">🕐</span>' +
    '<div class="stat-number">' + data.totalShifts + '</div>' +
    '<div class="stat-label">Tổng số ca làm</div>' +
    '</div>' +
    '<div class="stat-card-enhanced" style="border-left: 4px solid #3b82f6;">' +
    '<span class="stat-icon">📆</span>' +
    '<div class="stat-number" style="font-size:20px;">' + monthDisplay + '</div>' +
    '<div class="stat-label">Tháng thống kê</div>' +
    '</div>' +
    '</div>';
}

function renderDoubleShiftRanking(ranking) {
  var el = document.getElementById('overtimeRanking');
  if (!el) return;
  if (ranking.length === 0) {
    el.innerHTML = '';
    return;
  }
  var maxDays = ranking[0].totalDays;
  var html = '<div class="card"><h4>📊 Bảng xếp hạng nhân viên tăng ca</h4>';
  html += '<div style="max-height:500px; overflow-y:auto;">';
  ranking.forEach(function(item, idx) {
    var percentage = maxDays > 0 ? Math.round((item.totalDays / maxDays) * 100) : 0;
    var bgColor, borderColor, rankDisplay;
    if (idx === 0) {
      bgColor = '#fffbeb';
      borderColor = '#f59e0b';
      rankDisplay = '🥇';
    } else if (idx === 1) {
      bgColor = '#f8fafc';
      borderColor = '#94a3b8';
      rankDisplay = '🥈';
    } else if (idx === 2) {
      bgColor = '#fef2f2';
      borderColor = '#fca5a5';
      rankDisplay = '🥉';
    } else {
      bgColor = '#ffffff';
      borderColor = '#e5e7eb';
      rankDisplay = '<span style="color:#64748b; font-weight:700; min-width:30px; display:inline-block; text-align:center;">' + (idx + 1) + '</span>';
    }
    var barColors = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#ef4444'];
    var barColor = barColors[idx % barColors.length];
    var daysList = item.days.map(function(d) {
      return formatDate(d.date);
    }).join(', ');
    var daysPreview = '';
    if (item.days.length <= 5) {
      daysPreview = daysList;
    } else {
      var first5 = item.days.slice(0, 5).map(function(d) { return formatDate(d.date); }).join(', ');
      daysPreview = first5 + '... (+' + (item.days.length - 5) + ' ngày)';
    }
    html += '<div style="cursor:pointer;" onclick="showDoubleShiftDetail(\'' + item.employee.replace(/'/g, "\\'") + '\')" title="Click để xem chi tiết">';
    html += '<div style="display:flex; align-items:center; gap:12px; padding:14px 16px; background:' + bgColor +
      '; border:2px solid ' + borderColor + '; border-radius:10px; margin-bottom:4px;' +
      'box-shadow: 0 1px 3px rgba(0,0,0,0.06); transition: all 0.2s;">';
    html += '<div style="width:35px; text-align:center; font-size:20px;">' + rankDisplay + '</div>';
    html += '<div style="flex:1.5; font-weight:600; font-size:15px; color:#1e293b;">' + item.employee + '</div>';
    html += '<div style="flex:2; background:#e5e7eb; border-radius:12px; height:12px; overflow:hidden; box-shadow:inset 0 2px 4px rgba(0,0,0,0.1);">';
    html += '<div style="background:' + barColor + '; height:100%; width:' + percentage + '%; border-radius:12px; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: width 0.5s ease;"></div>';
    html += '</div>';
    html += '<div style="min-width:80px; text-align:right; font-weight:700; font-size:18px; color:' + barColor + ';">' +
      item.totalDays + ' <span style="font-size:13px; font-weight:400;">ngày</span></div>';
    html += '<div style="min-width:70px; text-align:right; font-size:13px; color:#64748b;">' +
      item.totalShifts + ' ca</div>';
    html += '</div>';
    html += '<div style="padding:4px 16px 8px 47px; font-size:12px; color:#64748b;">' +
      '📅 ' + daysPreview + '</div>';
    html += '</div>';
  });
  html += '</div></div>';
  el.innerHTML = html;
}

window.showDoubleShiftDetail = function(empName) {
  var data = window._doubleShiftData;
  if (!data) return;
  var empEntries = [];
  data.ranking.forEach(function(item) {
    if (item.employee === empName) {
      empEntries = item.days;
    }
  });
  empEntries.sort(function(a, b) { return b.date.localeCompare(a.date); });
  var detailEl = document.getElementById('overtimeDetail');
  if (!detailEl) return;
  var html = '<div class="card" style="margin-top:16px; border-left: 4px solid #f59e0b;">';
  html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
  html += '<h4 style="margin:0; font-size:16px;">👤 Chi tiết: <strong>' + empName + '</strong></h4>';
  html += '<span style="background:#fef3c7;color:#92400e;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;">' +
    empEntries.length + ' ngày</span>';
  html += '<button class="btn btn-xs" onclick="document.getElementById(\'overtimeDetail\').innerHTML=\'\'" ' +
    'style="margin-left:auto;background:#ef4444;color:white;border:none;padding:6px 12px;border-radius:6px;">✕ Đóng</button>';
  html += '</div>';
  html += '<div style="overflow-x:auto; -webkit-overflow-scrolling:touch; margin:0 -4px; padding:0 4px;">';
  html += '<table style="min-width:580px; width:100%; border-collapse:collapse; font-size:13px;">';
  html += '<thead><tr style="background:#f1f5f9;">';
  html += '<th style="padding:8px 6px; text-align:left; font-weight:600; white-space:nowrap; border-radius:8px 0 0 0;">📅 Ngày</th>';
  html += '<th style="padding:8px 6px; text-align:center; font-weight:600; white-space:nowrap;">🔢 Số ca</th>';
  html += '<th style="padding:8px 6px; text-align:left; font-weight:600; white-space:nowrap;">🕐 Tên ca</th>';
  html += '<th style="padding:8px 6px; text-align:left; font-weight:600; white-space:nowrap;">🔧 Công việc</th>';
  html += '<th style="padding:8px 10px; text-align:center; font-weight:600; white-space:nowrap;">🍚 Ăn</th>';
  html += '<th style="padding:8px 6px; text-align:left; font-weight:600; white-space:nowrap; border-radius:0 8px 0 0;">📝 Ghi chú</th>';
  html += '</tr></thead><tbody>';
  empEntries.forEach(function(entry, rowIdx) {
    var dateStr = formatDate(entry.date);
    var bgRow = rowIdx % 2 === 0 ? '#ffffff' : '#fafbfc';
    var countBadge = '<span style="background:#ef4444;color:white;padding:3px 10px;border-radius:12px;font-weight:700;font-size:12px;">' +
      entry.recordCount + '</span>';
    var shiftsHtml = '';
    entry.shiftNames.forEach(function(sn) {
      shiftsHtml += '<span class="shift-badge ' + getShiftColorClass(sn) + '" style="font-size:11px; padding:2px 7px;">' + sn + '</span> ';
    });
    var allTasks = [];
    entry.shifts.forEach(function(s) {
      s.tasks.forEach(function(t) {
        if (allTasks.indexOf(t.task) === -1) allTasks.push(t.task);
      });
    });
    var tasksHtml = allTasks.length > 0 ?
      '<span style="font-size:12px;">' + allTasks.join(', ') + '</span>' :
      '<span style="color:#94a3b8;">-</span>';
    var eats = entry.shifts.map(function(s) { return s.eat; });
    var uniqueEats = Array.from(new Set(eats));
    var eatHtml = '';
    uniqueEats.forEach(function(e) {
      if (e === 'Có') {
        eatHtml += '<span style="display:inline-block; background:#10b981; color:white; padding:4px 10px; border-radius:12px; font-weight:700; font-size:12px; box-shadow:0 2px 4px rgba(16,185,129,0.3);">✅ Có</span> ';
      } else {
        eatHtml += '<span style="display:inline-block; background:#ef4444; color:white; padding:4px 10px; border-radius:12px; font-weight:700; font-size:12px; box-shadow:0 2px 4px rgba(239,68,68,0.3);">❌ Không</span> ';
      }
    });
    var notes = [];
    entry.shifts.forEach(function(s) {
      if (s.note && s.note.trim()) notes.push(s.note);
    });
    var noteHtml = notes.length > 0 ?
      '<span style="font-size:11px;">' + notes.join('<br>') + '</span>' :
      '<span style="color:#94a3b8;">-</span>';
    html += '<tr style="border-bottom:1px solid #e5e7eb; background:' + bgRow + ';">' +
      '<td style="padding:10px 6px; white-space:nowrap; font-weight:500;">' + dateStr + '</td>' +
      '<td style="padding:10px 6px; text-align:center;">' + countBadge + '</td>' +
      '<td style="padding:10px 6px;">' + shiftsHtml + '</td>' +
      '<td style="padding:10px 6px; max-width:130px;">' + tasksHtml + '</td>' +
      '<td style="padding:10px 10px; text-align:center; white-space:nowrap;">' + eatHtml + '</td>' +
      '<td style="padding:10px 6px; max-width:110px;">' + noteHtml + '</td>' +
      '</tr>';
  });
  html += '</tbody></table></div></div>';
  detailEl.innerHTML = html;
  detailEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

window.exportDoubleShiftCSV = function() {
  var data = window._doubleShiftData;
  if (!data || !data.ranking || data.ranking.length === 0) {
    showAlert('⚠️ Không có dữ liệu tăng ca để xuất!');
    return;
  }
  var csv = '\uFEFFHạng,Nhân viên,Số ngày tăng ca,Tổng số ca,Danh sách ngày\n';
  data.ranking.forEach(function(item, idx) {
    var daysList = item.days.map(function(d) { return formatDate(d.date); }).join('; ');
    csv += (idx + 1) + ',"' + item.employee + '",' + item.totalDays + ',' + item.totalShifts + ',"' + daysList + '"\n';
  });
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'tangca_' + data.month + '.csv';
  a.click();
  log('Xuất CSV tăng ca tháng ' + data.month);
  showAlert('✅ Đã xuất file CSV thành công!');
};

// ==================== EDIT MODAL FUNCTIONS ====================
window.openEditModal = function(groupKey) {
  var allRecords = L(REC_KEY, []);
  var parts = groupKey.split('|');
  var groupDate = parts[0];
  var groupShift = parts[1];
  var groupEat = parts[2];
  var groupNote = parts[3] === '-' ? '' : parts[3];
  var groupTasks = [];
  try { groupTasks = JSON.parse(parts[4]); } catch (e) { groupTasks = []; }
  var matchingRecords = allRecords.filter(function(r) {
    return r.date === groupDate &&
      r.shift === groupShift &&
      r.eat === groupEat &&
      (r.note || '') === groupNote &&
      JSON.stringify(r.tasks || []) === JSON.stringify(groupTasks);
  });
  if (matchingRecords.length === 0) {
    showAlert('Không tìm thấy bản ghi!');
    return;
  }
  _editModalData.key = groupKey;
  _editModalData.employees = matchingRecords.map(function(r) { return r.employee; });
  _editModalData.originalEmployees = [..._editModalData.employees];
  _editModalData.originalDate = groupDate;
  _editModalData.originalShift = groupShift;
  _editModalData.originalEat = groupEat;
  _editModalData.originalNote = groupNote;
  _editModalData.originalTasks = JSON.parse(JSON.stringify(groupTasks));
  _editModalData.originalIds = matchingRecords.map(function(r) { return r.id; });
  _editModalData.tasks = groupTasks.map(function(t) { return t.task; });
  _editModalData.eat = groupEat;
  _editModalData.note = groupNote;
  var shiftName = groupShift ? groupShift.split('(')[0].trim() : '';
  _editModalData.shiftIndex = 0;
  shifts.forEach(function(s, i) {
    if (s.name === shiftName) _editModalData.shiftIndex = i;
  });
  renderModalContent();
  document.getElementById('editGroupModal').classList.add('show');
  setTimeout(function() {
    document.getElementById('modalEmpInput').focus();
  }, 300);
  document.getElementById('modalDate').value = groupDate;
};

function renderModalContent() {
  var tagsContainer = document.getElementById('modalEmpTags');
  tagsContainer.innerHTML = '';
  _editModalData.employees.forEach(function(name, i) {
    var tag = document.createElement('span');
    tag.className = 'employee-tag';
    tag.innerHTML = '<span class="tag-number">' + (i + 1) + '</span>' +
      cleanEmployeeName(name) +
      '<span class="remove-tag" data-name="' + name + '">×</span>';
    tagsContainer.appendChild(tag);
  });
  tagsContainer.querySelectorAll('.remove-tag').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      var name = this.dataset.name;
      _editModalData.employees = _editModalData.employees.filter(function(n) {
        return n !== name;
      });
      renderModalContent();
    };
  });
  var shiftGrid = document.getElementById('modalShiftGrid');
  shiftGrid.innerHTML = '';
  shifts.forEach(function(s, i) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shift-btn';
    if (i === _editModalData.shiftIndex) btn.classList.add('active');
    btn.innerHTML = '<div class="shift-icon">' + (s.icon || '🔹') + '</div>' +
      '<div class="shift-name">' + s.name + '</div>' +
      '<div class="shift-time">' + (s.time || '') + '</div>';
    btn.onclick = function() {
      _editModalData.shiftIndex = i;
      renderModalContent();
    };
    shiftGrid.appendChild(btn);
  });
  var eatRadio = document.querySelector('input[name="modalEat"][value="' + _editModalData.eat + '"]');
  if (eatRadio) eatRadio.checked = true;
  var groupsContainer = document.getElementById('modalGroupsCompact');
  groupsContainer.innerHTML = '';
  groups.forEach(function(g, gIdx) {
    if (!g.items || g.items.length === 0) return;
    var frame = document.createElement('div');
    frame.className = 'group-compact-frame';
    var header = document.createElement('div');
    header.className = 'group-compact-header';
    header.onclick = function() { frame.classList.toggle('open'); };
    header.innerHTML = '<div class="group-compact-header-left">' +
      '<span class="group-compact-dot" style="background:' + (g.color || '#ccc') + '"></span>' +
      '<span class="group-compact-title">' + g.title + '</span></div>' +
      '<span class="group-compact-arrow">▼</span>';
    frame.appendChild(header);
    var body = document.createElement('div');
    body.className = 'group-compact-body';
    var tasksDiv = document.createElement('div');
    tasksDiv.className = 'group-compact-tasks';
    g.items.forEach(function(it) {
      var isChecked = _editModalData.tasks.includes(it.name);
      var taskDiv = document.createElement('div');
      taskDiv.className = 'group-compact-task';
      if (isChecked) taskDiv.classList.add('checked');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isChecked;
      cb.onchange = function() {
        if (this.checked) {
          if (!_editModalData.tasks.includes(it.name)) {
            _editModalData.tasks.push(it.name);
          }
          taskDiv.classList.add('checked');
        } else {
          _editModalData.tasks = _editModalData.tasks.filter(function(t) {
            return t !== it.name;
          });
          taskDiv.classList.remove('checked');
        }
      };
      taskDiv.appendChild(cb);
      var nameSpan = document.createElement('span');
      nameSpan.className = 'group-compact-task-name';
      nameSpan.textContent = it.name;
      taskDiv.appendChild(nameSpan);
      tasksDiv.appendChild(taskDiv);
    });
    body.appendChild(tasksDiv);
    frame.appendChild(body);
    groupsContainer.appendChild(frame);
  });
  document.getElementById('modalNote').value = _editModalData.note || '';
}

window.addEmployeeToModal = function(empName) {
  if (_editModalData.employees.includes(empName)) return;
  _editModalData.employees.push(empName);
  renderModalContent();
  document.getElementById('modalEmpInput').value = '';
  document.getElementById('modalEmpAutocomplete').style.display = 'none';
};

window.saveGroupFromModal = async function() {
  if (_editModalData.employees.length === 0) {
    await showAlert('Vui lòng chọn ít nhất 1 nhân viên!');
    return;
  }
  var allRecords = L(REC_KEY, []);
  allRecords = allRecords.filter(function(r) {
    return !(_editModalData.originalEmployees.includes(r.employee) &&
      r.date === _editModalData.originalDate &&
      r.shift === _editModalData.originalShift &&
      r.eat === _editModalData.originalEat &&
      (r.note || '') === _editModalData.originalNote &&
      JSON.stringify(r.tasks || []) === JSON.stringify(_editModalData.originalTasks));
  });
  var shift = shifts[_editModalData.shiftIndex];
  var shiftStr = shift ? shift.name + ' (' + shift.time + ')' : '';
  var note = document.getElementById('modalNote').value.trim();
  var eat = document.querySelector('input[name="modalEat"]:checked')?.value || 'Có';
  var taskObjects = [];
  _editModalData.tasks.forEach(function(taskName) {
    groups.forEach(function(g) {
      g.items.forEach(function(it) {
        if (it.name === taskName) {
          taskObjects.push({ group: g.title, task: it.name });
        }
      });
    });
  });
  var now = new Date().toISOString();
  var shiftName = shift ? shift.name : '';
  if (taskObjects.length === 0 && shiftName !== 'Nghỉ') {
    await showAlert('⚠️ Vui lòng chọn ít nhất 1 công đoạn làm việc!', 'Thiếu thông tin');
    return;
  }
  var newDate = (document.getElementById('modalDate')?.value || _editModalData.originalDate).split('T')[0];
  var taskNames = (taskObjects || []).map(function(t) { return t.task; }).sort().join(',');
  var existingRecords = L(REC_KEY, []);
  var duplicateNames = [];
  var editingIds = _editModalData.originalIds || [];
  _editModalData.employees.forEach(function(empName, empIdx) {
    var duplicate = existingRecords.some(function(r) {
      var rTaskNames = (r.tasks || []).map(function(t) { return t.task; }).sort().join(',');
      if (editingIds.indexOf(r.id) > -1) return false;
      return r.employee === empName &&
        r.date === newDate &&
        (r.shift || '').split('(')[0].trim() === shiftName &&
        rTaskNames === taskNames;
    });
    if (duplicate) duplicateNames.push(cleanEmployeeName(empName));
  });
  if (duplicateNames.length > 0) {
    await showAlert('⚠️ Những nhân viên sau đã có bản ghi TRÙNG hoàn toàn ở ngày ' + formatDate(newDate) + ':\n\n' + duplicateNames.join(', ') + '\n\nKhông thể lưu.', 'Cảnh báo trùng');
    return;
  }
  _editModalData.employees.forEach(function(empName, i) {
    allRecords.push({
      id: (_editModalData.originalIds && _editModalData.originalIds[i]) ? _editModalData.originalIds[i] : ('rec_' + Date.now() + '_' + i),
      employee: empName,
      date: (document.getElementById('modalDate')?.value || _editModalData.originalDate).split('T')[0],
      shift: shiftStr,
      eat: eat,
      tasks: taskObjects,
      note: note,
      timestamp: now,
      lastModified: Date.now()
    });
  });
  S(REC_KEY, allRecords);
  log('Sửa nhóm ' + _editModalData.employees.length + ' NV qua modal');
  closeEditModal();
  window._statsData = allRecords;
  applyStatsFilters();
  await showAlert('✅ Cập nhật thành công!');
};

window.deleteGroupFromModal = async function() {
  var confirmed = await showConfirm(
    'Xóa nhóm ' + _editModalData.employees.length + ' nhân viên?\n' +
    '📅 ' + formatDate(_editModalData.originalDate) + '\n\n' +
    '⚠️ Không thể hoàn tác!',
    'Xác nhận xóa'
  );
  if (!confirmed) return;
  var allRecords = L(REC_KEY, []);
  allRecords = allRecords.filter(function(r) {
    return !(_editModalData.originalEmployees.includes(r.employee) &&
      r.date === _editModalData.originalDate &&
      r.shift === _editModalData.originalShift &&
      r.eat === _editModalData.originalEat &&
      (r.note || '') === _editModalData.originalNote &&
      JSON.stringify(r.tasks || []) === JSON.stringify(_editModalData.originalTasks));
  });
  S(REC_KEY, allRecords);
  log('Xóa nhóm ' + _editModalData.originalEmployees.length + ' NV qua modal');
  closeEditModal();
  window._statsData = allRecords;
  applyStatsFilters();
  await showAlert('✅ Đã xóa!');
};

window.closeEditModal = function() {
  document.getElementById('editGroupModal').classList.remove('show');
  _editModalData = {
    key: null, employees: [], shiftIndex: 0, tasks: [],
    eat: 'Có', note: '', originalDate: '', originalShift: '',
    originalEat: '', originalNote: '', originalTasks: [], originalEmployees: [],
    originalIds: []
  };
};

function initModalAutocomplete() {
  var input = document.getElementById('modalEmpInput');
  var list = document.getElementById('modalEmpAutocomplete');
  if (!input || !list) return;
  input.addEventListener('input', function() {
    var val = this.value.trim();
    list.innerHTML = '';
    if (!val) { list.style.display = 'none'; return; }
    var matches = getVisibleEmployees().filter(function(e) {
      return !_editModalData.employees.includes(e.name) &&
        (containsExactChars(cleanEmployeeName(e.name), val) ||
          containsExactChars(e.name, val));
    });
    if (matches.length === 0) {
      list.innerHTML = '<div class="autocomplete-no-result">Không tìm thấy</div>';
      list.style.display = 'block';
      return;
    }
    matches.slice(0, 8).forEach(function(e) {
      var div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.innerHTML = '<span>👤</span><span>' + cleanEmployeeName(e.name) + '</span>';
      div.onclick = function() { addEmployeeToModal(e.name); };
      list.appendChild(div);
    });
    list.style.display = 'block';
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var first = list.querySelector('.autocomplete-item');
      if (first) first.click();
    }
    if (e.key === 'Escape') {
      list.style.display = 'none';
      this.blur();
    }
  });
  document.addEventListener('click', function(e) {
    if (e.target !== input && !list.contains(e.target)) {
      list.style.display = 'none';
    }
  });
}

// ==================== SUB-TABS CONTROL ====================
window.switchSubTab = function(tabName) {
  document.querySelectorAll('#statsContent .sub-tab').forEach(function(btn) { btn.classList.remove('active'); });
  var dashboardEl = document.getElementById('subTabDashboard'),
    shiftEl = document.getElementById('subTabShiftDetail'),
    taskEl = document.getElementById('subTabTaskDetail'),
    overtimeEl = document.getElementById('subTabOvertime');
  if (dashboardEl) dashboardEl.style.display = 'none';
  if (shiftEl) shiftEl.style.display = 'none';
  if (taskEl) taskEl.style.display = 'none';
  if (overtimeEl) overtimeEl.style.display = 'none';
  var subTabs = document.querySelectorAll('#statsContent .sub-tab');
  if (tabName === 'dashboard') {
    if (dashboardEl) dashboardEl.style.display = 'block';
    if (subTabs[0]) subTabs[0].classList.add('active');
    applyStatsFilters();
  } else if (tabName === 'shift-detail') {
    if (shiftEl) shiftEl.style.display = 'block';
    if (subTabs[1]) subTabs[1].classList.add('active');
  } else if (tabName === 'task-detail') {
    if (taskEl) taskEl.style.display = 'block';
    if (subTabs[2]) subTabs[2].classList.add('active');
  } else if (tabName === 'double-shift') {
    if (overtimeEl) overtimeEl.style.display = 'block';
    if (subTabs[3]) subTabs[3].classList.add('active');
    loadDoubleShiftRanking();
  }
};

// ==================== PERSONAL TAB FUNCTIONS ====================
function renderPersonalTab() {
  var el = document.getElementById('personalContent');
  if (!el) return;
  el.innerHTML =
    '<div class="card"><h3>🔍 Tra cứu & Thống kê cá nhân</h3>' +
    '<div class="filter-row" style="margin-top:8px;">' +
    '<div class="input-with-clear" style="flex:1;">' +
    '<input type="text" id="personalEmpInput" placeholder="👤 Nhập tên giống tên trên kế hoạch..." autocomplete="off" />' +
    '<button type="button" class="clear-btn" id="personalClearBtn" onclick="clearPersonalInput()" title="Xóa tên">✕</button>' +
    '<div id="personalEmpAutocomplete" class="autocomplete-list"></div>' +
    '</div></div>' +
    '<div class="filter-row" style="margin-top:8px;"><select id="personalDateType" style="width:150px;" onchange="togglePersonalDateType()"><option value="all">📅 Tất cả</option><option value="date">📅 Theo ngày</option><option value="month">📅 Theo tháng</option></select>' +
    '<input type="date" id="personalDateInput" title="Chọn ngày" style="flex:1; display:none;" /><input type="month" id="personalMonthInput" title="Chọn tháng" style="flex:1; display:none;" />' +
    '<button class="btn btn-primary btn-sm" onclick="loadPersonalRecords()" style="min-width:80px;">🔍 Xem</button></div>' +
    '<div id="personalSummary" style="margin-top:16px;"><div class="muted" style="text-align:center;padding:20px">👆 Nhập tên nhân viên và nhấn Xem để tra cứu</div></div><div id="personalRecords" style="margin-top:12px;"></div></div>';
  setTimeout(function() { initPersonalEmpAutocomplete(); }, 100);
}

window.togglePersonalDateType = function() {
  var type = document.getElementById('personalDateType')?.value;
  var dateInput = document.getElementById('personalDateInput'),
    monthInput = document.getElementById('personalMonthInput');
  if (!dateInput || !monthInput) return;
  if (type === 'date') {
    dateInput.style.display = 'block';
    monthInput.style.display = 'none';
    if (!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
  } else if (type === 'month') {
    dateInput.style.display = 'none';
    monthInput.style.display = 'block';
    if (!monthInput.value) {
      var today = new Date();
      monthInput.value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0');
    }
  } else {
    dateInput.style.display = 'none';
    monthInput.style.display = 'none';
  }
};

function initPersonalEmpAutocomplete() {
  var input = document.getElementById('personalEmpInput'),
    autocomplete = document.getElementById('personalEmpAutocomplete');
  if (!input || !autocomplete) return;
  var newInput = input.cloneNode(true);
  input.parentNode.replaceChild(newInput, input);
  input = newInput;
  input.addEventListener('input', function() {
    var val = this.value.trim();
    autocomplete.innerHTML = '';
    if (!val) {
      autocomplete.style.display = 'none';
      return;
    }
    var matches = [];
    var visibleEmp = getVisibleEmployees();
    visibleEmp.forEach(function(e) {
      var cleanName = cleanEmployeeName(e.name);
      if (containsExactChars(cleanName, val) || containsExactChars(e.name, val)) matches.push(e);
    });
    matches.sort(function(a, b) { return removeAccents(cleanEmployeeName(a.name)).localeCompare(removeAccents(cleanEmployeeName(b.name))); });
    if (matches.length === 0) {
      autocomplete.innerHTML = '<div class="autocomplete-no-result">🔍 Không tìm thấy nhân viên</div>';
      autocomplete.style.display = 'block';
      return;
    }
    matches.slice(0, 8).forEach(function(e) {
      var div = document.createElement('div');
      div.className = 'autocomplete-item';
      div.innerHTML = '<span style="margin-right:6px;">👤</span><span style="flex:1;">' + cleanEmployeeName(e.name) + '</span>';
      div.addEventListener('click', function() {
        input.value = cleanEmployeeName(e.name);
        autocomplete.style.display = 'none';
        loadPersonalRecords();
      });
      autocomplete.appendChild(div);
    });
    autocomplete.style.display = 'block';
  });
  document.addEventListener('click', function(e) {
    if (e.target !== input && !autocomplete.contains(e.target)) autocomplete.style.display = 'none';
  });
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      autocomplete.style.display = 'none';
      this.blur();
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      var items = autocomplete.querySelectorAll('.autocomplete-item');
      if (items.length > 0) items[0].click();
      else loadPersonalRecords();
    }
  });
  input.addEventListener('blur', function() {
    setTimeout(function() {
      if (!autocomplete.contains(document.activeElement)) autocomplete.style.display = 'none';
    }, 200);
  });
  input.addEventListener('input', function() {
    toggleClearButton('personalEmpInput', 'personalClearBtn');
  });
  setTimeout(function() {
    toggleClearButton('personalEmpInput', 'personalClearBtn');
  }, 100);
}

window.clearPersonalInput = function() {
  var input = document.getElementById('personalEmpInput');
  if (input) {
    input.value = '';
    input.focus();
    var clearBtn = document.getElementById('personalClearBtn');
    if (clearBtn) clearBtn.classList.remove('show');
    var summaryEl = document.getElementById('personalSummary');
    var recordsEl = document.getElementById('personalRecords');
    if (summaryEl) summaryEl.innerHTML = '<div class="muted" style="text-align:center;padding:20px">👆 Nhập tên nhân viên và nhấn Xem để tra cứu</div>';
    if (recordsEl) recordsEl.innerHTML = '';
  }
};

function loadPersonalRecords() {
  var empInput = document.getElementById('personalEmpInput'),
    empName = empInput ? empInput.value.trim() : '';
  var dateType = document.getElementById('personalDateType')?.value || 'all',
    dateVal = document.getElementById('personalDateInput')?.value || '',
    monthVal = document.getElementById('personalMonthInput')?.value || '';
  var summaryEl = document.getElementById('personalSummary'),
    recordsEl = document.getElementById('personalRecords');
  if (!summaryEl || !recordsEl) return;
  if (!empName) {
    summaryEl.innerHTML = '<div class="muted" style="text-align:center;padding:20px">👆 Nhập tên nhân viên và nhấn Xem để tra cứu</div>';
    recordsEl.innerHTML = '';
    return;
  }
  var matchedEmp = emp.find(function(e) {
    return cleanEmployeeName(e.name).toLowerCase() === empName.toLowerCase() ||
      e.name.toLowerCase() === empName.toLowerCase() ||
      removeAccents(cleanEmployeeName(e.name).toLowerCase()) === removeAccents(empName.toLowerCase()) ||
      removeAccents(e.name.toLowerCase()) === removeAccents(empName.toLowerCase());
  });
  if (!matchedEmp) {
    summaryEl.innerHTML = '<div class="muted" style="text-align:center;padding:20px;color:#dc2626;">⚠️ Không tìm thấy nhân viên "' + empName + '" trong danh sách</div>';
    recordsEl.innerHTML = '';
    return;
  }
  var rec = L(REC_KEY, []),
    personalRecs = rec.filter(function(r) { return r.employee === matchedEmp.name; });
  if (dateType === 'date' && dateVal) {
    personalRecs = personalRecs.filter(function(r) { return r.date === dateVal; });
  } else if (dateType === 'month' && monthVal) {
    personalRecs = personalRecs.filter(function(r) { return r.date.startsWith(monthVal); });
  }
  personalRecs.sort(function(a, b) { return b.date.localeCompare(a.date); });
  var totalHours = personalRecs.reduce(function(sum, r) {
    return sum + getShiftHours(r.shift);
  }, 0);
  var totalDays = Math.round((totalHours / 8) * 100) / 100;
  var totalDaysDisplay = totalDays % 1 === 0 ? totalDays.toFixed(0) : totalDays.toFixed(2);
  var eatDaysSet = new Set();
  personalRecs.forEach(function(r) {
    if (r.eat === 'Có') {
      eatDaysSet.add(r.date);
    }
  });
  var eatDays = eatDaysSet.size;
  var eatPercent = totalDays > 0 ? Math.round((eatDays / totalDays) * 100) : 0;
  var tienCom = eatDays * 30000;
  var tienComFormatted = tienCom.toLocaleString('vi-VN') + 'đ';
  var caHours = {};
  var caDays = {};
  personalRecs.forEach(function(r) {
    var caName = r.shift ? r.shift.split('(')[0].trim() : 'Khác';
    var hours = getShiftHours(r.shift);
    if (hours > 0) {
      caHours[caName] = (caHours[caName] || 0) + hours;
    } else {
      caDays[caName] = (caDays[caName] || 0) + 1;
    }
  });
  var topShift = '',
    topShiftHours = 0;
  for (var ca in caHours) {
    if (caHours[ca] > topShiftHours) {
      topShiftHours = caHours[ca];
      topShift = ca;
    }
  }
  var summaryHTML = '<div class="stat-dashboard">';
  summaryHTML += '<div class="stat-card-enhanced"><span class="stat-icon">📅</span><div class="stat-number">' + totalDaysDisplay + '</div><div class="stat-label">Ngày làm việc (8h/ngày)</div></div>';
  summaryHTML += '<div class="stat-card-enhanced"><span class="stat-icon">⏱️</span><div class="stat-number">' + totalHours + 'h</div><div class="stat-label">Tổng giờ công</div></div>';
  summaryHTML += '<div class="stat-card-enhanced"><span class="stat-icon">🍚</span><div class="stat-number">' + eatDays + '</div><div class="stat-label">Ngày ăn cơm (' + eatPercent + '%)</div></div>';
  summaryHTML += '<div class="stat-card-enhanced"><span class="stat-icon">💰</span><div class="stat-number" style="font-size:20px;">' + tienComFormatted + '</div><div class="stat-label">Tiền cơm (' + eatDays + ' ngày × 30.000đ)</div></div>';
  summaryHTML += '<div class="stat-card-enhanced"><span class="stat-icon">🕐</span><div class="stat-number" style="font-size:18px;">' + topShift + '</div><div class="stat-label">Ca nhiều nhất (' + topShiftHours + ' giờ)</div></div>';
  summaryHTML += '</div>';
  if (Object.keys(caHours).length > 0 || Object.keys(caDays).length > 0) {
    summaryHTML += '<div style="margin-top:12px"><b>📊 Phân bố ca làm việc:</b>';
    var sortedCas = Object.keys(caHours).sort(function(a, b) {
      return caHours[b] - caHours[a];
    });
    for (var i = 0; i < sortedCas.length; i++) {
      var ca = sortedCas[i];
      var percent = totalHours > 0 ? Math.round((caHours[ca] / totalHours) * 100) : 0;
      var barWidth = Math.max(percent, 5);
      var cong = Math.round((caHours[ca] / 8) * 100) / 100;
      var congDisplay = cong % 1 === 0 ? cong.toFixed(0) : cong.toFixed(2);
      summaryHTML += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6;"><span style="min-width:60px;font-size:13px;font-weight:500;">' + ca + '</span><div style="flex:1;background:#f1f5f9;border-radius:10px;height:16px;overflow:hidden;"><div style="background:linear-gradient(90deg, #2563eb, #60a5fa);height:100%;width:' + barWidth + '%;border-radius:10px;"></div></div><span style="font-weight:600;font-size:13px;min-width:80px;">' + congDisplay + ' công (' + percent + '%)</span></div>';
    }
    var sortedDays = Object.keys(caDays).sort(function(a, b) {
      return caDays[b] - caDays[a];
    });
    for (var j = 0; j < sortedDays.length; j++) {
      var caDay = sortedDays[j];
      var dayCount = caDays[caDay];
      var totalRecordsCount = personalRecs.length;
      var percentDay = totalRecordsCount > 0 ? Math.round((dayCount / totalRecordsCount) * 100) : 0;
      var barWidthDay = Math.max(percentDay, 5);
      summaryHTML += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #f3f4f6;"><span style="min-width:60px;font-size:13px;font-weight:500;">' + caDay + '</span><div style="flex:1;background:#f1f5f9;border-radius:10px;height:16px;overflow:hidden;"><div style="background:linear-gradient(90deg, #94a3b8, #64748b);height:100%;width:' + barWidthDay + '%;border-radius:10px;"></div></div><span style="font-weight:600;font-size:13px;min-width:80px;">' + dayCount + ' ngày nghỉ</span></div>';
    }
    summaryHTML += '</div>';
  }
  var taskCountMap = {};
  personalRecs.forEach(function(r) {
    var shiftName = r.shift ? r.shift.split('(')[0].trim().toLowerCase() : '';
    var heSo = 0;
    if (shiftName.includes('1/2') || shiftName.includes('bán tg')) {
      heSo = 0.5;
    } else if (shiftName.includes('nghỉ') || shiftName.includes('off')) {
      heSo = 0;
    } else {
      heSo = 1;
    }
    r.tasks.forEach(function(t) {
      taskCountMap[t.task] = (taskCountMap[t.task] || 0) + heSo;
    });
  });
  var taskRanking = Object.entries(taskCountMap).sort(function(a, b) { return b[1] - a[1]; });
  if (taskRanking.length > 0) {
    var taskHtml = '<div style="margin-top:16px; background:white; border-radius:12px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.08);">';
    taskHtml += '<h4 style="margin:0 0 12px 0;">📋 Thống kê công đoạn đã làm</h4>';
    taskHtml += '<table class="stats-table-compact" style="width:100%;">';
    taskHtml += '<tr><th>STT</th><th>Công đoạn</th><th>Số lần thực hiện</th><th>Tỉ lệ</th></tr>';
    var totalTasks = taskRanking.reduce(function(s, item) { return s + item[1]; }, 0);
    taskRanking.forEach(function(item, idx) {
      var countVal = item[1];
      var countDisplay = countVal % 1 === 0 ? countVal.toFixed(0) : countVal.toFixed(1);
      var percent = Math.round((item[1] / totalTasks) * 100);
      var barColor = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444'][idx % 6];
      taskHtml += '<tr>';
      taskHtml += '<td>' + (idx + 1) + '</td>';
      taskHtml += '<td><strong>' + item[0] + '</strong></td>';
      taskHtml += '<td><span style="background:' + barColor + '; color:white; padding:3px 10px; border-radius:12px; font-weight:600; font-size:13px;">' + countDisplay + ' lần</span></td>';
      taskHtml += '<td>' + percent + '%</td>';
      taskHtml += '</tr>';
    });
    taskHtml += '</table></div>';
    summaryHTML += taskHtml;
  }
  summaryEl.innerHTML = summaryHTML;
  if (!personalRecs.length) {
    recordsEl.innerHTML = '<div class="muted" style="text-align:center;padding:16px;margin-top:12px;">Không có bản ghi nào phù hợp</div>';
  } else {
    var allRecords = L(REC_KEY, []);
    var html = '<div style="margin-top:12px;"><h4 style="margin:0 0 10px 0;">📋 Chi tiết chấm công</h4><div style="overflow-x:auto"><table class="stats-table-compact"><tr><th>Ngày</th><th>Ca</th><th>Công đoạn</th><th>Đồng nghiệp</th><th>Ăn</th><th>Ghi chú</th></tr>';
    personalRecs.forEach(function(recItem) {
      var colleagues = allRecords.filter(function(r) {
        return r.date === recItem.date &&
          r.shift === recItem.shift &&
          cleanEmployeeName(r.employee) !== cleanEmployeeName(recItem.employee) &&
          (r.tasks || []).some(function(t1) {
            return (recItem.tasks || []).some(function(t2) { return t1.task === t2.task; });
          });
      }).map(function(r) { return cleanEmployeeName(r.employee); });
      var uniqueColleagues = Array.from(new Set(colleagues));
      var tasksStr = recItem.tasks.map(function(t) { return t.task; }).join(', ');
      var colleaguesStr = uniqueColleagues.length > 0 ? uniqueColleagues.join(', ') : '<span class="muted">Một mình</span>';
      var noteStr = recItem.note || '-',
        noteDisplay = noteStr.length > 25 ? noteStr.substring(0, 25) + '...' : noteStr;
      var eatBadge = recItem.eat === 'Có' ? 'yes' : 'no',
        shiftName = recItem.shift ? recItem.shift.split('(')[0].trim() : '-';
      var escapedNote = noteStr.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, ' ');
      html += '<tr><td class="date-compact">' + formatDate(recItem.date) + '</td><td><span class="shift-badge">' + shiftName + '</span></td><td class="task-list-compact">' + tasksStr + '</td><td>' + colleaguesStr + '</td><td><span class="eat-badge ' + eatBadge + '">' + (recItem.eat || '-') + '</span></td><td class="note-cell-personal" onclick="showNotePopup(event, \'' + escapedNote + '\')" onmouseenter="showNotePopup(event, \'' + escapedNote + '\')" onmouseleave="hideNotePopup()">' + noteDisplay + '</td></tr>';
    });
    html += '</table></div></div>';
    recordsEl.innerHTML = html;
  }
}

// ==================== NOTE POPUP FUNCTIONS ====================
window.showNotePopup = function(event, noteText) {
  var popup = document.getElementById('notePopup');
  if (!popup || !noteText || noteText === '-') return;
  popup.textContent = noteText;
  popup.style.display = 'block';
  var x = event.clientX;
  var y = event.clientY;
  var popupWidth = popup.offsetWidth || 300;
  var popupHeight = popup.offsetHeight || 60;
  if (x + popupWidth + 10 > window.innerWidth) {
    x = window.innerWidth - popupWidth - 20;
  }
  if (y - popupHeight - 15 < 0) {
    popup.style.top = (y + 20) + 'px';
  } else {
    popup.style.top = (y - popupHeight - 10) + 'px';
  }
  popup.style.left = (x - 10) + 'px';
};

window.hideNotePopup = function() {
  var popup = document.getElementById('notePopup');
  if (popup) {
    popup.style.display = 'none';
  }
};

// ==================== MOVE GROUP FUNCTIONS ====================
window.moveGroupUp = function(gidx) {
  window._manualSort = true;
  var key = _tableGroupMap[gidx];
  if (!key) return;
  var allRecords = L(REC_KEY, []);
  var sortedKeys = Object.keys(_tableGroupMap);
  var currentIdx = -1;
  for (var i = 0; i < sortedKeys.length; i++) {
    if (_tableGroupMap[sortedKeys[i]] === key) { currentIdx = i; break; }
  }
  if (currentIdx <= 0) return;
  var prevKey = _tableGroupMap[sortedKeys[currentIdx - 1]];
  var parts1 = key.split('|');
  var parts2 = prevKey.split('|');
  var group1Date = parts1[0],
    group1Shift = parts1[1],
    group1Eat = parts1[2],
    group1Note = parts1[3] === '-' ? '' : parts1[3];
  var group2Date = parts2[0],
    group2Shift = parts2[1],
    group2Eat = parts2[2],
    group2Note = parts2[3] === '-' ? '' : parts2[3];
  var group1Tasks = [];
  try { group1Tasks = JSON.parse(parts1[4]); } catch (e) {}
  var group2Tasks = [];
  try { group2Tasks = JSON.parse(parts2[4]); } catch (e) {}
  var group1Records = allRecords.filter(function(r) {
    return r.date === group1Date && r.shift === group1Shift && r.eat === group1Eat &&
      (r.note || '') === group1Note && JSON.stringify(r.tasks || []) === JSON.stringify(group1Tasks);
  });
  allRecords = allRecords.filter(function(r) {
    return !(r.date === group1Date && r.shift === group1Shift && r.eat === group1Eat &&
      (r.note || '') === group1Note && JSON.stringify(r.tasks || []) === JSON.stringify(group1Tasks));
  });
  var insertIdx = allRecords.findIndex(function(r) {
    return r.date === group2Date && r.shift === group2Shift && r.eat === group2Eat &&
      (r.note || '') === group2Note && JSON.stringify(r.tasks || []) === JSON.stringify(group2Tasks);
  });
  allRecords.splice.apply(allRecords, [insertIdx, 0].concat(group1Records));
  S(REC_KEY, allRecords);
  window._statsData = allRecords;
  var currentFiltered = [];
  var fromDate = heatmapRange.start || '';
  var toDate = heatmapRange.end || '';
  var empFilter = document.getElementById('statsEmpInput')?.value?.trim() || '';
  var shiftFilter = document.getElementById('statsShiftFilter')?.value || '';
  var taskFilter = document.getElementById('statsTaskFilter')?.value || '';
  currentFiltered = allRecords.filter(function(r) {
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    if (shiftFilter && !r.shift.startsWith(shiftFilter)) return false;
    if (taskFilter && !(r.tasks || []).some(function(t) { return t.task === taskFilter; })) return false;
    return true;
  });
  renderStatsTable(currentFiltered);
};

window.moveGroupDown = function(gidx) {
  window._manualSort = true;
  var key = _tableGroupMap[gidx];
  if (!key) return;
  var allRecords = L(REC_KEY, []);
  var sortedKeys = Object.keys(_tableGroupMap);
  var currentIdx = -1;
  for (var i = 0; i < sortedKeys.length; i++) {
    if (_tableGroupMap[sortedKeys[i]] === key) { currentIdx = i; break; }
  }
  if (currentIdx === -1 || currentIdx >= sortedKeys.length - 1) return;
  var nextKey = _tableGroupMap[sortedKeys[currentIdx + 1]];
  var parts1 = key.split('|');
  var parts2 = nextKey.split('|');
  var group1Date = parts1[0],
    group1Shift = parts1[1],
    group1Eat = parts1[2],
    group1Note = parts1[3] === '-' ? '' : parts1[3];
  var group2Date = parts2[0],
    group2Shift = parts2[1],
    group2Eat = parts2[2],
    group2Note = parts2[3] === '-' ? '' : parts2[3];
  var group1Tasks = [];
  try { group1Tasks = JSON.parse(parts1[4]); } catch (e) {}
  var group2Tasks = [];
  try { group2Tasks = JSON.parse(parts2[4]); } catch (e) {}
  var group1Records = allRecords.filter(function(r) {
    return r.date === group1Date && r.shift === group1Shift && r.eat === group1Eat &&
      (r.note || '') === group1Note && JSON.stringify(r.tasks || []) === JSON.stringify(group1Tasks);
  });
  allRecords = allRecords.filter(function(r) {
    return !(r.date === group1Date && r.shift === group1Shift && r.eat === group1Eat &&
      (r.note || '') === group1Note && JSON.stringify(r.tasks || []) === JSON.stringify(group1Tasks));
  });
  var insertIdx = allRecords.findIndex(function(r) {
    return r.date === group2Date && r.shift === group2Shift && r.eat === group2Eat &&
      (r.note || '') === group2Note && JSON.stringify(r.tasks || []) === JSON.stringify(group2Tasks);
  });
  if (insertIdx === -1) return;
  allRecords.splice.apply(allRecords, [insertIdx + group1Records.length, 0].concat(group1Records));
  S(REC_KEY, allRecords);
  window._statsData = allRecords;
  var currentFiltered = [];
  var fromDate = heatmapRange.start || '';
  var toDate = heatmapRange.end || '';
  var empFilter = document.getElementById('statsEmpInput')?.value?.trim() || '';
  var shiftFilter = document.getElementById('statsShiftFilter')?.value || '';
  var taskFilter = document.getElementById('statsTaskFilter')?.value || '';
  currentFiltered = allRecords.filter(function(r) {
    if (fromDate && r.date < fromDate) return false;
    if (toDate && r.date > toDate) return false;
    if (shiftFilter && !r.shift.startsWith(shiftFilter)) return false;
    if (taskFilter && !(r.tasks || []).some(function(t) { return t.task === taskFilter; })) return false;
    return true;
  });
  renderStatsTable(currentFiltered);
};

// ==================== EXPORT FUNCTIONS ====================
window.exportStatsCSV = function() {
  var rec = L(REC_KEY, []);
  if (!rec.length) { showAlert('Không có dữ liệu!'); return; }
  var csv = '\uFEFFNgày,Nhân viên,Ca,Ăn cơm,Ghi chú,Công việc\n';
  rec.sort(function(a, b) { return b.date.localeCompare(a.date); });
  rec.forEach(function(r) {
    var tasks = r.tasks ? r.tasks.map(function(t) { return t.task; }).join('; ') : '';
    var note = (r.note || '').replace(/"/g, '""');
    csv += '"' + formatDate(r.date) + '","' + cleanEmployeeName(r.employee) + '","' + (r.shift || '') + '","' + (r.eat || '') + '","' + note + '","' + tasks + '"\n';
  });
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'chamcong_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  log('Xuất thống kê CSV');
};

window.exportStatsPDF = async function() {
  const statsContainer = document.getElementById('pageThongKe');
  if (!statsContainer) { showAlert('❌ Không tìm thấy nội dung thống kê!'); return; }
  const btn = document.querySelector('#subTabDashboard .btn-primary');
  if (btn) { btn.disabled = true;
    btn.textContent = '⏳ Đang xuất...'; }
  try {
    const originalStyle = statsContainer.style.cssText;
    statsContainer.style.overflow = 'visible';
    statsContainer.style.maxHeight = 'none';
    statsContainer.style.height = 'auto';
    const canvas = await html2canvas(statsContainer, { scale: 2, useCORS: true, logging: false, windowWidth: statsContainer.scrollWidth, windowHeight: statsContainer.scrollHeight });
    statsContainer.style.cssText = originalStyle;
    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 10;
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save('thongke_chamcong.pdf');
    log('Xuất PDF thành công');
  } catch (error) {
    console.error(error);
    showAlert('❌ Có lỗi khi xuất PDF: ' + error.message);
  } finally {
    if (btn) { btn.disabled = false;
      btn.textContent = '📄 Xuất PDF'; }
  }
};

async function clearAllRecords() {
  if (!await showConfirm('XÓA TẤT CẢ bản ghi?')) return;
  S(REC_KEY, []);
  log('Xóa tất cả bản ghi');
  renderStatistics();
  await showAlert('✅ Đã xóa!');
}

// ==================== BACKUP & RESTORE ====================
function backupAllData() {
  var data = {
    employees: L(EMP_KEY, []),
    shifts: L(SHIFT_KEY, D_SHIFTS),
    groups: L(GROUP_KEY, D_GROUPS),
    records: L(REC_KEY, []),
    audit: L(AUDIT_KEY, []),
    backupDate: new Date().toISOString(),
    version: '1.0'
  };
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'backup_' + new Date().toISOString().split('T')[0] + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  log('Backup toàn bộ dữ liệu');
  showAlert('✅ Đã backup thành công!');
}

async function restoreAllData() {
  if (!await showConfirm('⚠️ KHÔI PHỤC sẽ ghi đè TẤT CẢ dữ liệu hiện tại!', '⚠️ Cảnh báo')) return;
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async function(e) {
    var file = e.target.files[0];
    if (!file) return;
    try {
      var text = await readFileAsText(file);
      var data = JSON.parse(text);
      if (!data.version) throw new Error('File backup không hợp lệ');
      S(EMP_KEY, data.employees);
      S(SHIFT_KEY, data.shifts);
      S(GROUP_KEY, data.groups);
      S(REC_KEY, data.records);
      S(AUDIT_KEY, data.audit || []);
      emp = data.employees;
      shifts = data.shifts;
      groups = data.groups;
      expanded = {};
      rEmp();
      rShifts();
      rGFull();
      rGCompact();
      rShiftList();
      renderAudit();
      renderStatistics();
      log('Khôi phục dữ liệu');
      await showAlert('✅ Đã khôi phục thành công!');
    } catch (err) {
      await showAlert('❌ Lỗi: ' + err.message);
    }
  };
  input.click();
}

// ==================== UPLOAD TO GITHUB ====================
window.uploadToGithub = function() {
  var fullData = {
    employees: JSON.parse(localStorage.getItem('e') || '[]'),
    groups: JSON.parse(localStorage.getItem('g') || '[]'),
    records: JSON.parse(localStorage.getItem('r') || '[]')
  };
  var jsonStr = JSON.stringify(fullData);
  var blob = new Blob([jsonStr], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showAlert('✅ File data.json đầy đủ đã tải về!\n\n👉 Vào GitHub → Upload file này lên.');
};

// ==================== SEARCH RECORDS ====================
window.searchRecords = async function() {
  var term = await showPrompt('Nhập tên nhân viên hoặc ngày (dd/mm/yyyy):', '', '🔍 Tìm kiếm');
  if (!term || !term.trim()) return;
  var rec = L(REC_KEY, []);
  term = term.toLowerCase().trim();
  var results = rec.filter(function(r) {
    return cleanEmployeeName(r.employee).toLowerCase().includes(term) || formatDate(r.date).includes(term);
  });
  if (!results.length) { await showAlert('Không tìm thấy!'); return; }
  results.sort(function(a, b) { return b.date.localeCompare(a.date); });
  results = results.slice(0, 20);
  var msg = 'Tìm thấy ' + results.length + ' bản ghi:\n\n';
  results.forEach(function(r, i) {
    msg += (i + 1) + '. ' + cleanEmployeeName(r.employee) + ' - ' + formatDate(r.date) + ' - ' + (r.shift || '') + '\n';
  });
  msg += '\nNhập số thứ tự để sửa/xóa (0 để hủy):';
  var choice = await showPrompt(msg, '0', '🔍 Kết quả');
  if (!choice || choice === '0') return;
  var index = parseInt(choice) - 1;
  if (isNaN(index) || index < 0 || index >= results.length) { await showAlert('Số không hợp lệ!'); return; }
  var sel = results[index];
  var action = await showConfirm('Bản ghi: ' + sel.employee + ' - ' + formatDate(sel.date) + '\nCa: ' + (sel.shift || '') + '\nGhi chú: ' + (sel.note || 'Không có') + '\n\nOK = SỬA, Cancel = XÓA', '🔧 Thao tác');
  if (action) {
    selectedEmployees = [sel.employee];
    renderSelectedEmployees();
    document.getElementById('attDate').value = sel.date;
    var shiftName = sel.shift ? sel.shift.split('(')[0].trim() : '';
    shifts.forEach(function(s, i) {
      if (s.name === shiftName) selShift(i);
    });
    var eatRadio = document.querySelector('input[name="eat"][value="' + sel.eat + '"]');
    if (eatRadio) eatRadio.checked = true;
    else {
      var d = document.querySelector('input[name="eat"][value="Có"]');
      if (d) d.checked = true;
    }
    document.querySelectorAll('.task-checkbox').forEach(function(cb) {
      cb.checked = false;
      if (sel.tasks) sel.tasks.forEach(function(t) {
        groups.forEach(function(g) {
          g.items.forEach(function(it) {
            if (it.name === t.task) cb.checked = (cb.dataset.task === it.id);
          });
        });
      });
    });
    var noteInput = document.getElementById('attNote');
    if (noteInput) {
      noteInput.value = sel.note || '';
      updateNoteCharCount((sel.note || '').length);
    }
    switchTab('ChamCong');
    await showAlert('Đã load bản ghi. Sửa và nhấn Lưu.');
  } else {
    if (!await showConfirm('XÓA bản ghi: ' + sel.employee + ' - ' + formatDate(sel.date) + '?')) return;
    var recAll = L(REC_KEY, []);
    var idx = recAll.findIndex(function(r) {
      return r.employee === sel.employee && r.date === sel.date && r.shift === sel.shift;
    });
    if (idx >= 0) {
      recAll.splice(idx, 1);
      S(REC_KEY, recAll);
      log('Xóa bản ghi: ' + sel.employee + ' - ' + formatDate(sel.date));
      await showAlert('✅ Đã xóa!');
      renderStatistics();
    }
  }
};

// ==================== DELETE RECORD GROUP ====================
window.deleteRecordGroup = async function(key) {
  var allRecords = L(REC_KEY, []);
  var parts = key.split('|');
  var groupDate = parts[0],
    groupShift = parts[1],
    groupEat = parts[2],
    groupNote = parts[3] === '-' ? '' : parts[3];
  var groupTasks = [];
  try { groupTasks = JSON.parse(parts[4]); } catch (e) { groupTasks = []; }
  var matchingRecords = allRecords.filter(function(r) {
    return r.date === groupDate && r.shift === groupShift && r.eat === groupEat && (r.note || '') === groupNote && JSON.stringify(r.tasks || []) === JSON.stringify(groupTasks);
  });
  if (matchingRecords.length === 0) { showAlert('Không tìm thấy bản ghi phù hợp!'); return; }
  var employees = matchingRecords.map(function(r) { return r.employee; });
  var empList = employees.join(', ');
  var confirmed = await showConfirm('Bạn muốn xóa tất cả bản ghi của nhóm này?\n\n📅 Ngày: ' + formatDate(groupDate) + '\n👥 Nhân viên: ' + empList + '\n🕐 Ca: ' + (groupShift ? groupShift.split('(')[0].trim() : '-') + '\n🍚 Ăn: ' + groupEat + '\n\n⚠️ Hành động này không hoàn tác được!', 'Xác nhận xóa');
  if (!confirmed) return;
  allRecords = allRecords.filter(function(r) {
    return !(employees.includes(r.employee) && r.date === groupDate && r.shift === groupShift && r.eat === groupEat && (r.note || '') === groupNote && JSON.stringify(r.tasks || []) === JSON.stringify(groupTasks));
  });
  localStorage.setItem('last_sync_time', '0');
  S(REC_KEY, allRecords);
  if (USE_GOOGLE_SHEETS && matchingRecords.length > 0) {
    matchingRecords.forEach(function(r) {
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = GOOGLE_SHEETS_API + '?action=deleteRecord&sheet=records&id=' + encodeURIComponent(r.id);
      document.body.appendChild(iframe);
      setTimeout(function() { document.body.removeChild(iframe); }, 3000);
    });
    console.log('✅ Đã xóa ' + matchingRecords.length + ' bản ghi trên Sheets');
  }
  log('Xóa nhóm ' + employees.length + ' NV: ' + empList + ' ngày ' + formatDate(groupDate));
  window._statsData = allRecords;
  applyStatsFilters();
  showAlert('✅ Đã xóa ' + employees.length + ' bản ghi thành công!', 'Xóa thành công');
};

// ==================== GOOGLE SHEETS SYNC ====================
async function sheetsRead(sheetName) {
  var url = GOOGLE_SHEETS_API + '?action=read&sheet=' + encodeURIComponent(sheetName);
  var response = await fetch(url);
  return await response.json();
}

async function syncFromSheets() {
  if (!USE_GOOGLE_SHEETS) return;
  try {
    console.log('🔄 Đang tải dữ liệu mới nhất...');
    var [empData, shiftData, groupData, recData] = await Promise.all([
      sheetsRead('employees'),
      sheetsRead('shifts'),
      sheetsRead('groups'),
      sheetsRead('records')
    ]);
    if (empData && empData.length > 0) localStorage.setItem(EMP_KEY, JSON.stringify(empData));
    if (shiftData && shiftData.length > 0) localStorage.setItem(SHIFT_KEY, JSON.stringify(shiftData));
    if (groupData && groupData.length > 0) {
      groupData.forEach(function(row) {
        if (row.items && typeof row.items === 'string') {
          try { row.items = JSON.parse(row.items); } catch (e) { row.items = []; }
        }
      });
      localStorage.setItem(GROUP_KEY, JSON.stringify(groupData));
    }
    if (recData && recData.length > 0) {
      recData.forEach(function(row) {
        if (row.tasks && typeof row.tasks === 'string') {
          try { row.tasks = JSON.parse(row.tasks); } catch (e) { row.tasks = []; }
        }
        if (row.date) {
          var cleanDate = String(row.date).replace(/'/g, '').split('T')[0];
          if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
            row.date = cleanDate;
          }
        }
      });
      localStorage.setItem(REC_KEY, JSON.stringify(recData));
    }
    console.log('✅ Đã tải: ' + (empData ? empData.length : 0) + ' NV, ' + (recData ? recData.length : 0) + ' bản ghi');
  } catch (e) {
    console.error('❌ Lỗi tải dữ liệu:', e);
  }
}

function refreshAllUI() {
  rShifts();
  rGFull();
  rGCompact();
  rEmp();
  rShiftList();
  renderAudit();
  renderStatistics();
  renderMissingEmployees();
  var empCount = document.getElementById('empCount');
  if (empCount) empCount.textContent = emp.length + ' NV';
}

// ==================== CLOCK ====================
function updateClock() {
  var now = new Date();
  var h = String(now.getHours()).padStart(2, '0');
  var m = String(now.getMinutes()).padStart(2, '0');
  var s = String(now.getSeconds()).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var month = String(now.getMonth() + 1).padStart(2, '0');
  var y = now.getFullYear();
  var str = '⏰ Hiện tại là: ' + h + ':' + m + ':' + s + ' - Ngày ' + d + '/' + month + '/' + y;
  document.getElementById('liveClock').textContent = str;
}

// ==================== INIT ====================
function init() {
  if (!Date.prototype._toISOString) {
    Date.prototype._toISOString = Date.prototype.toISOString;
    Date.prototype.toISOString = function() {
      var offset = 7 * 60 * 60 * 1000;
      var d = new Date(this.getTime() + offset);
      return d._toISOString().split('T')[0] + 'T00:00:00.000Z';
    };
  }
  checkAdmin();
  var savedToken = localStorage.getItem('github_token');
  if (savedToken && savedToken.length > 0) {
    GITHUB_TOKEN = savedToken;
    console.log('🔐 Đã load GitHub Token từ máy này');
  }
  loadHiddenEmployeesFast().then(function() {
    rEmp();
    refreshAllAutocompletes();
  });
  if (!isAdmin) {
    fetch('https://raw.githubusercontent.com/qlccnoibo/cc/main/data.json?t=' + Date.now())
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data) {
          if (data.employees) {
            localStorage.setItem('e', JSON.stringify(data.employees));
          }
          if (data.groups) {
            localStorage.setItem('g', JSON.stringify(data.groups));
          }
          if (data.records) {
            localStorage.setItem('r', JSON.stringify(data.records));
          }
          refreshAllUI();
          rEmp();
          console.log('✅ Đã tải dữ liệu từ GitHub');
        }
      })
      .catch(function(e) {
        console.error('❌ Lỗi:', e);
      });
  }
  var attDate = document.getElementById('attDate');
  if (attDate) attDate.value = new Date().toISOString().split('T')[0];
  rShifts();
  rGFull();
  rGCompact();
  rEmp();
  rShiftList();
  renderAudit();
  renderStatistics();
  initAutocomplete();
  renderSelectedEmployees();
  initNoteCharCount();
  renderMissingEmployees();
  var empCount = document.getElementById('empCount');
  if (empCount) empCount.textContent = emp.length + ' NV';
  if (USE_GOOGLE_SHEETS) {
    syncFromSheets().then(function() {
      rShifts();
      rGFull();
      rGCompact();
      rEmp();
      rShiftList();
      renderAudit();
      renderStatistics();
      renderMissingEmployees();
      var empCount = document.getElementById('empCount');
      if (empCount) empCount.textContent = emp.length + ' NV';
      console.log('✅ Đã cập nhật giao diện với dữ liệu mới từ Sheets');
    });
  }
  updateClock();
  setInterval(updateClock, 1000);
  initModalAutocomplete();
  document.getElementById('editGroupModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
  });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' &&
      document.getElementById('editGroupModal').classList.contains('show')) {
      closeEditModal();
    }
  });
}

// ==================== EVENT BINDINGS ====================
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('tabChamCong').onclick = function() { switchTab('ChamCong'); };
  document.getElementById('tabThongKe').onclick = function() { switchTab('ThongKe'); };
  document.getElementById('tabCaNhan').onclick = function() { switchTab('CaNhan'); };
  document.getElementById('tabQuanLy').onclick = function() { switchTab('QuanLy'); };

  var addGroupBtn = document.getElementById('addGroupBtn');
  if (addGroupBtn) addGroupBtn.onclick = function() { addG(); };

  var addEmpBtn = document.getElementById('addEmpBtn');
  if (addEmpBtn) addEmpBtn.onclick = function() { addEmp(); };

  var clearAllEmp = document.getElementById('clearAllEmp');
  if (clearAllEmp) clearAllEmp.onclick = function() { clrEmp(); };

  var addShiftBtn = document.getElementById('addShiftBtn');
  if (addShiftBtn) addShiftBtn.onclick = function() { addShift(); };

  var clearAudit = document.getElementById('clearAudit');
  if (clearAudit) clearAudit.onclick = function() { clearAudit(); };

  var exportGroups = document.getElementById('exportGroups');
  if (exportGroups) exportGroups.onclick = function() { expG(); };

  var importGroupsBtn = document.getElementById('importGroupsBtn');
  if (importGroupsBtn) importGroupsBtn.onclick = function() {
    document.getElementById('importGroups').click();
  };

  var importGroups = document.getElementById('importGroups');
  if (importGroups) importGroups.onchange = function() { impG(this); };

  var resetGroups = document.getElementById('resetGroups');
  if (resetGroups) resetGroups.onclick = function() { rstG(); };

  var attendanceForm = document.getElementById('attendanceForm');
  if (attendanceForm) {
    attendanceForm.onsubmit = function(e) {
      var keepTs = window._editTimestamp || null;
      var result = subAtt(e, keepTs);
      window._editTimestamp = null;
      return result;
    };
  }

  var clearForm = document.getElementById('clearForm');
  if (clearForm) clearForm.onclick = function() { rstForm(); };

  if (impB) { impB.disabled = true;
    impB.style.opacity = '0.6'; }

  var shiftListEl = document.getElementById('shiftList');
  if (shiftListEl) {
    shiftListEl.addEventListener('click', function(e) {
      var b = e.target.closest('button[data-act="delS"]');
      if (b) hDS(b.dataset.id);
    });
  }
});

// ==================== START APP ====================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

window.onRowDragStart = function(e) {
    e.dataTransfer.setData('text/plain', e.target.closest('tr').dataset.gidx);
    e.target.closest('tr').classList.add('dragging');
};

window.onRowDragOver = function(e) {
    e.preventDefault();
};

// 3 HÀM KÉO THẢ
window.onRowDrop = function(e) {
    e.preventDefault();
    var fromGidx = e.dataTransfer.getData('text/plain');
    var toTr = e.target.closest('tr');
    if (!toTr) return;
    var toGidx = toTr.dataset.gidx;
    
    if (fromGidx === toGidx) return;
    
    var fromKey = _tableGroupMap[fromGidx];
    var toKey = _tableGroupMap[toGidx];
    
    // Hoán đổi vị trí 2 nhóm
    var allRecords = L(REC_KEY, []);
    
    // Tìm records của 2 nhóm
    var partsFrom = fromKey.split('|');
    var partsTo = toKey.split('|');
    
    var fromDate = partsFrom[0], fromShift = partsFrom[1], fromEat = partsFrom[2], fromNote = partsFrom[3] === '-' ? '' : partsFrom[3];
    var toDate = partsTo[0], toShift = partsTo[1], toEat = partsTo[2], toNote = partsTo[3] === '-' ? '' : partsTo[3];
    var fromTasks = []; try { fromTasks = JSON.parse(partsFrom[4]); } catch(e) {}
    var toTasks = []; try { toTasks = JSON.parse(partsTo[4]); } catch(e) {}
    
    // Lấy records của nhóm FROM
    var fromRecords = allRecords.filter(function(r) {
        return r.date === fromDate && r.shift === fromShift && r.eat === fromEat && 
               (r.note || '') === fromNote && JSON.stringify(r.tasks || []) === JSON.stringify(fromTasks);
    });
    
    // Xóa nhóm FROM khỏi mảng
    allRecords = allRecords.filter(function(r) {
        return !(r.date === fromDate && r.shift === fromShift && r.eat === fromEat && 
               (r.note || '') === fromNote && JSON.stringify(r.tasks || []) === JSON.stringify(fromTasks));
    });
    
    // Tìm vị trí nhóm TO trong mảng mới
    var insertIdx = allRecords.findIndex(function(r) {
        return r.date === toDate && r.shift === toShift && r.eat === toEat && 
               (r.note || '') === toNote && JSON.stringify(r.tasks || []) === JSON.stringify(toTasks);
    });
    
    if (insertIdx === -1) return;
    
    // Chèn nhóm FROM vào vị trí nhóm TO
    allRecords.splice.apply(allRecords, [insertIdx, 0].concat(fromRecords));
    
    S(REC_KEY, allRecords);
    window._statsData = allRecords;
    renderStatsTable(allRecords);
};