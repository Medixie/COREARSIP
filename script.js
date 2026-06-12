const API_URL = 'https://script.google.com/macros/s/AKfycbxBCfGOi1LtmzCuTvw6OGkDBX0NToqQZf1H0VNwxubYodP2BCI0mVaT4sTiYSMEKNWQ/exec';

let userData = JSON.parse(localStorage.getItem('SIARDI_USERS')) || [];
let unitData = JSON.parse(localStorage.getItem('SIARDI_UNITS')) || [];
let kategoriData = JSON.parse(localStorage.getItem('SIARDI_KATEGORI')) || [];
let retensiData = JSON.parse(localStorage.getItem('SIARDI_RETENSI')) || [];
let peminjamanData = JSON.parse(localStorage.getItem('SIARDI_PEMINJAMAN')) || [];

let arsipData = JSON.parse(localStorage.getItem('SIARDI_DATA')) || [
  // data dummy kamu
];

let categoryChart = null;
let statusChart = null;

let editingUnitId = null;
let editingKategoriId = null;
let editingRetensiId = null;
let editingPeminjamanId = null;

/* =========================
   KIRIM DATA KE SPREADSHEET
========================= */

async function sendToSpreadsheet(action, payload) {
  try {
    updateSyncStatus('syncing', 'Sinkronisasi...');

    const response = await fetch(API_URL, {
      method: 'POST',
      redirect: 'follow',

      /*
       * text/plain digunakan agar request tidak memicu
       * preflight CORS yang tidak diperlukan.
       */
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },

      body: JSON.stringify({
        action: action,
        payload: payload
      })
    });

    if (!response.ok) {
      throw new Error(
        `Server merespons dengan status ${response.status}.`
      );
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(
        result.message || 'Request gagal diproses.'
      );
    }

    updateSyncStatus('online', 'Spreadsheet Aktif');

    return result;

  } catch (error) {
    console.error(
      'Gagal kirim ke Spreadsheet:',
      error
    );

    updateSyncStatus('offline', 'Local Mode');

    throw error;
  }
}

async function loadArsipFromSpreadsheet() {
  try {
    updateSyncStatus(
      'syncing',
      'Memuat data arsip...'
    );

    const response = await fetch(
      API_URL +
      '?action=GET_ARSIP&ts=' +
      Date.now()
    );

    if (!response.ok) {
      throw new Error(
        `Gagal mengambil data: ${response.status}`
      );
    }

    const result = await response.json();

    const rows = Array.isArray(result.data)
      ? result.data
      : Array.isArray(result)
        ? result
        : [];

    arsipData = rows
      .map(function (row) {
        return {
          id:
            row.ID_ARSIP ||
            row.id ||
            '',

          nomor:
            row.NOMOR_ARSIP ||
            row.nomor ||
            '',

          judul:
            row.JUDUL_ARSIP ||
            row.judul ||
            '',

          kategori:
            row.KATEGORI ||
            row.kategori ||
            '',

          unit:
            row.UNIT_KERJA ||
            row.unit ||
            '',

          tahun:
            row.TAHUN ||
            row.tahun ||
            '',

          tanggalArsip:
            row.TANGGAL_ARSIP ||
            '',

          retensiAktif:
            row.RETENSI_AKTIF ||
            '',

          retensiInaktif:
            row.RETENSI_INAKTIF ||
            '',

          nasibAkhir:
            row.NASIB_AKHIR ||
            '',

          status:
            row.STATUS_RETENSI ||
            row.status ||
            '',

          lokasiFisik:
            row.LOKASI_FISIK ||
            '',

          linkFile:
            row.LINK_FILE ||
            '',

          fileId:
            row.FILE_ID ||
            '',

          file:
            row.NAMA_FILE ||
            (
              row.LINK_FILE
                ? 'Buka File'
                : '-'
            ),

          hasFile:
            Boolean(row.FILE_ID),

          statusPinjam:
            row.STATUS_PINJAM ||
            'TERSEDIA',

          kataKunci:
            row.KATA_KUNCI ||
            '',

          keterangan:
            row.KETERANGAN ||
            '',

          keamanan:
            row.KLASIFIKASI_KEAMANAN ||
            'INTERNAL',

          tanggalEvaluasiRetensi:
            row.TANGGAL_EVALUASI_RETENSI ||
            '',

          workflowStatus:
            row.WORKFLOW_STATUS ||
            'AKTIF'
        };
      })
      .filter(function (item) {
        return (
          item.id ||
          item.nomor ||
          item.judul
        );
      });

    localStorage.setItem(
      'SIARDI_DATA',
      JSON.stringify(arsipData)
    );

    resetTablePage('arsip');
    renderAll();
    initArchiveFilters();

    if (
      typeof buildAutomaticNotifications ===
      'function'
    ) {
      buildAutomaticNotifications();
    }

    updateSyncStatus(
      'online',
      `Spreadsheet Aktif • ${arsipData.length} arsip`
    );

  } catch (error) {
    console.error(
      'Gagal memuat data Spreadsheet:',
      error
    );

    updateSyncStatus(
      'offline',
      'Local Mode'
    );

    renderAll();
    initArchiveFilters();

    showToast(
      'Spreadsheet belum dapat dimuat. Sistem menggunakan data lokal.',
      'warning'
    );
  }
}

function showSaveLoader(title = 'Menyimpan Data', text = 'Mohon tunggu sebentar...') {
  const loader = document.getElementById('saveLoader');
  const loaderTitle = document.getElementById('saveLoaderTitle');
  const loaderText = document.getElementById('saveLoaderText');

  if (loaderTitle) loaderTitle.textContent = title;
  if (loaderText) loaderText.textContent = text;

  document.body.classList.add('is-save-loading');

  if (loader) loader.classList.add('active');
}

function hideSaveLoader() {
  const loader = document.getElementById('saveLoader');

  if (loader) loader.classList.remove('active');

  document.body.classList.remove('is-save-loading');
}

function showToast(message, type = 'success', title = '') {
  const toast = document.getElementById('toastNotification');
  const toastIcon = document.getElementById('toastIcon');
  const toastTitle = document.getElementById('toastTitle');
  const toastMessage = document.getElementById('toastMessage');

  if (!toast) return;

  toast.className = 'toast-notification active';

  if (type === 'warning') {
    toast.classList.add('warning');
    if (toastIcon) toastIcon.textContent = '!';
    if (toastTitle) toastTitle.textContent = title || 'Perhatian';
  } else if (type === 'error') {
    toast.classList.add('error');
    if (toastIcon) toastIcon.textContent = '×';
    if (toastTitle) toastTitle.textContent = title || 'Gagal';
  } else {
    if (toastIcon) toastIcon.textContent = '✓';
    if (toastTitle) toastTitle.textContent = title || 'Berhasil';
  }

  if (toastMessage) toastMessage.textContent = message;

  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(function () {
    toast.classList.remove('active');
  }, 2600);
}

/* =========================
   STATUS SINKRON SPREADSHEET
========================= */

function updateSyncStatus(status, text) {
  const chip = document.getElementById('syncChip');
  const syncText = document.getElementById('syncText');

  if (!chip) return;

  chip.classList.remove('online', 'offline', 'syncing');
  chip.classList.add(status);

  if (syncText) {
    syncText.textContent = text;
  }
}

let pendingDeleteAction = null;

function showDeleteModal(title, message, onConfirm) {
  const modal = document.getElementById('deleteModal');
  const modalTitle = document.getElementById('deleteModalTitle');
  const modalText = document.getElementById('deleteModalText');

  if (modalTitle) modalTitle.textContent = title || 'Hapus Data?';
  if (modalText) modalText.textContent = message || 'Data yang dihapus tidak dapat dikembalikan.';

  pendingDeleteAction = onConfirm;

  if (modal) modal.classList.add('active');
}

function closeDeleteModal() {
  const modal = document.getElementById('deleteModal');

  if (modal) modal.classList.remove('active');

  pendingDeleteAction = null;
}

async function confirmDeleteAction() {
  if (typeof pendingDeleteAction !== 'function') {
    closeDeleteModal();
    return;
  }

  const action = pendingDeleteAction;

  closeDeleteModal();

  await action();
}

/* =========================
   UNIT KERJA
========================= */

function openUnitForm() {
  document.getElementById('unitFormBox').classList.add('active');
}

async function saveUnit() {
  const kode = document.getElementById('kodeUnit').value.trim();
  const nama = document.getElementById('namaUnit').value.trim();
  const pic = document.getElementById('picUnit').value.trim();
  const status = document.getElementById('statusUnit').value;
  const keterangan = document.getElementById('keteranganUnit').value.trim();

  if (!kode || !nama) {
    showToast('Kode unit dan nama unit wajib diisi.', 'warning');
    return;
  }

  showSaveLoader('Menyimpan Unit Kerja', 'Data unit sedang diproses...');

  try {
    let data;

    if (editingUnitId) {
      const index = unitData.findIndex(item => item.id === editingUnitId);

      if (index !== -1) {
        data = {
          ...unitData[index],
          kode,
          nama,
          pic,
          status,
          keterangan
        };

        unitData[index] = data;
      }
    } else {
      data = {
        id: 'UNT-' + String(Date.now()).slice(-5),
        kode,
        nama,
        pic,
        status,
        keterangan
      };

      unitData.push(data);
    }

    localStorage.setItem('SIARDI_UNITS', JSON.stringify(unitData));

    await sendToSpreadsheet('SAVE_UNIT', data);

    clearUnitForm();
    renderUnitTable();
    refreshInputMasterOptions();

    hideSaveLoader();
    showToast(editingUnitId ? 'Data unit berhasil diperbarui.' : 'Data unit berhasil disimpan.', 'success');

  } catch (error) {
    hideSaveLoader();
    console.error(error);
    showToast('Data unit gagal disimpan.', 'error');
  }
}

function renderUnitTable() {
  const tbody = document.getElementById('unitTable');
  if (!tbody) return;

  if (!unitData.length) {
    tbody.innerHTML = `<tr><td colspan="6">Belum ada data unit kerja.</td></tr>`;
    return;
  }

  tbody.innerHTML = unitData.map(item => `
    <tr>
      <td><b>${item.kode}</b></td>
      <td>${item.nama}</td>
      <td>${item.pic || '-'}</td>
      <td><span class="status-badge ${String(item.status).toLowerCase()}">${item.status}</span></td>
      <td>${item.keterangan || '-'}</td>
      <td>
        <div class="action-group">
          <button class="btn-edit" onclick="editUnit('${item.id}')">✎</button>
          <button class="btn-delete" onclick="deleteUnit('${item.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editUnit(id) {
  const item = unitData.find(x => x.id === id);
  if (!item) return;

  editingUnitId = id;
  document.getElementById('kodeUnit').value = item.kode || '';
  document.getElementById('namaUnit').value = item.nama || '';
  document.getElementById('picUnit').value = item.pic || '';
  document.getElementById('statusUnit').value = item.status || 'Aktif';
  document.getElementById('keteranganUnit').value = item.keterangan || '';
  document.getElementById('btnSaveUnit').textContent = 'Update Unit';

  openUnitForm();
}

function deleteUnit(id) {
  showDeleteModal(
    'Hapus Unit Kerja?',
    'Unit kerja akan dihapus dari sistem dan Spreadsheet.',
    async function () {
      showSaveLoader('Menghapus Unit Kerja', 'Data unit sedang dihapus...');

      try {
        unitData = unitData.filter(function (item) {
          return item.id !== id;
        });

        localStorage.setItem('SIARDI_UNITS', JSON.stringify(unitData));

        await sendToSpreadsheet('DELETE_UNIT', { id: id });

        renderUnitTable();

        hideSaveLoader();
        showToast('Data unit berhasil dihapus.', 'success');

      } catch (error) {
        hideSaveLoader();
        console.error(error);
        showToast('Data unit gagal dihapus.', 'error');
      }
    }
  );
}

function clearUnitForm() {
  editingUnitId = null;
  document.getElementById('kodeUnit').value = '';
  document.getElementById('namaUnit').value = '';
  document.getElementById('picUnit').value = '';
  document.getElementById('statusUnit').value = 'Aktif';
  document.getElementById('keteranganUnit').value = '';
  document.getElementById('btnSaveUnit').textContent = 'Simpan Unit';
}

/* =========================
   KATEGORI ARSIP
========================= */

function openKategoriForm() {
  document.getElementById('kategoriFormBox').classList.add('active');
}

async function saveKategori() {
  const kode = document.getElementById('kodeKategori').value.trim();
  const nama = document.getElementById('namaKategori').value.trim();
  const jenis = document.getElementById('jenisKategori').value;
  const status = document.getElementById('statusKategori').value;
  const keterangan = document.getElementById('keteranganKategori').value.trim();

  if (!kode || !nama) {
    showToast('Kode kategori dan nama kategori wajib diisi.', 'warning');
    return;
  }

  showSaveLoader('Menyimpan Kategori Arsip', 'Data kategori sedang diproses...');

  try {
    let data;

    if (editingKategoriId) {
      const index = kategoriData.findIndex(item => item.id === editingKategoriId);

      if (index !== -1) {
        data = {
          ...kategoriData[index],
          kode,
          nama,
          jenis,
          status,
          keterangan
        };

        kategoriData[index] = data;
      }
    } else {
      data = {
        id: 'KAT-' + String(Date.now()).slice(-5),
        kode,
        nama,
        jenis,
        status,
        keterangan
      };

      kategoriData.push(data);
    }

    localStorage.setItem('SIARDI_KATEGORI', JSON.stringify(kategoriData));

    await sendToSpreadsheet('SAVE_KATEGORI', data);

    clearKategoriForm();
    renderKategoriTable();
    refreshInputMasterOptions();

    hideSaveLoader();
    showToast(editingKategoriId ? 'Data kategori berhasil diperbarui.' : 'Data kategori berhasil disimpan.', 'success');

  } catch (error) {
    hideSaveLoader();
    console.error(error);
    showToast('Data kategori gagal disimpan.', 'error');
  }
}

function renderKategoriTable() {
  const tbody = document.getElementById('kategoriTable');
  if (!tbody) return;

  if (!kategoriData.length) {
    tbody.innerHTML = `<tr><td colspan="6">Belum ada data kategori arsip.</td></tr>`;
    return;
  }

  tbody.innerHTML = kategoriData.map(item => `
    <tr>
      <td><b>${item.kode}</b></td>
      <td>${item.nama}</td>
      <td><span class="divisi-badge">${item.jenis || '-'}</span></td>
      <td><span class="status-badge ${String(item.status).toLowerCase()}">${item.status}</span></td>
      <td>${item.keterangan || '-'}</td>
      <td>
        <div class="action-group">
          <button class="btn-edit" onclick="editKategori('${item.id}')">✎</button>
          <button class="btn-delete" onclick="deleteKategori('${item.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editKategori(id) {
  const item = kategoriData.find(x => x.id === id);
  if (!item) return;

  editingKategoriId = id;
  document.getElementById('kodeKategori').value = item.kode || '';
  document.getElementById('namaKategori').value = item.nama || '';
  document.getElementById('jenisKategori').value = item.jenis || 'Surat';
  document.getElementById('statusKategori').value = item.status || 'Aktif';
  document.getElementById('keteranganKategori').value = item.keterangan || '';
  document.getElementById('btnSaveKategori').textContent = 'Update Kategori';

  openKategoriForm();
}

function deleteKategori(id) {
  showDeleteModal(
    'Hapus Kategori Arsip?',
    'Kategori arsip akan dihapus dari sistem dan Spreadsheet.',
    async function () {
      showSaveLoader('Menghapus Kategori', 'Data kategori sedang dihapus...');

      try {
        kategoriData = kategoriData.filter(function (item) {
          return item.id !== id;
        });

        localStorage.setItem('SIARDI_KATEGORI', JSON.stringify(kategoriData));

        await sendToSpreadsheet('DELETE_KATEGORI', { id: id });

        renderKategoriTable();

        hideSaveLoader();
        showToast('Data kategori berhasil dihapus.', 'success');

      } catch (error) {
        hideSaveLoader();
        console.error(error);
        showToast('Data kategori gagal dihapus.', 'error');
      }
    }
  );
}

function clearKategoriForm() {
  editingKategoriId = null;
  document.getElementById('kodeKategori').value = '';
  document.getElementById('namaKategori').value = '';
  document.getElementById('jenisKategori').value = 'Surat';
  document.getElementById('statusKategori').value = 'Aktif';
  document.getElementById('keteranganKategori').value = '';
  document.getElementById('btnSaveKategori').textContent = 'Simpan Kategori';
}

/* =========================
   RETENSI ARSIP
========================= */

function openRetensiForm() {
  document.getElementById('retensiFormBox').classList.add('active');
}

async function saveRetensi() {
  const kategori = document.getElementById('kategoriRetensi').value.trim();
  const masaAktif = document.getElementById('masaAktifRetensi').value.trim();
  const masaInaktif = document.getElementById('masaInaktifRetensi').value.trim();
  const statusAkhir = document.getElementById('statusAkhirRetensi').value;
  const keterangan = document.getElementById('keteranganRetensi').value.trim();

  if (!kategori || !masaAktif || !masaInaktif) {
    showToast('Kategori, masa aktif, dan masa inaktif wajib diisi.', 'warning');
    return;
  }

  showSaveLoader('Menyimpan Retensi Arsip', 'Data retensi sedang diproses...');

  try {
    let data;

    if (editingRetensiId) {
      const index = retensiData.findIndex(item => item.id === editingRetensiId);

      if (index !== -1) {
        data = {
          ...retensiData[index],
          kategori,
          masaAktif,
          masaInaktif,
          statusAkhir,
          keterangan
        };

        retensiData[index] = data;
      }
    } else {
      data = {
        id: 'RET-' + String(Date.now()).slice(-5),
        kategori,
        masaAktif,
        masaInaktif,
        statusAkhir,
        keterangan
      };

      retensiData.push(data);
    }

    localStorage.setItem('SIARDI_RETENSI', JSON.stringify(retensiData));

    await sendToSpreadsheet('SAVE_RETENSI', data);

    clearRetensiForm();
    renderRetensiTable();

    hideSaveLoader();
    showToast(editingRetensiId ? 'Data retensi berhasil diperbarui.' : 'Data retensi berhasil disimpan.', 'success');

  } catch (error) {
    hideSaveLoader();
    console.error(error);
    showToast('Data retensi gagal disimpan.', 'error');
  }
}

function renderRetensiTable() {
  const tbody = document.getElementById('retensiTable');
  if (!tbody) return;

  if (!retensiData.length) {
    tbody.innerHTML = `<tr><td colspan="6">Belum ada data retensi arsip.</td></tr>`;
    return;
  }

  tbody.innerHTML = retensiData.map(item => `
    <tr>
      <td><b>${item.kategori}</b></td>
      <td>${item.masaAktif}</td>
      <td>${item.masaInaktif}</td>
      <td><span class="role-badge">${item.statusAkhir}</span></td>
      <td>${item.keterangan || '-'}</td>
      <td>
        <div class="action-group">
          <button class="btn-edit" onclick="editRetensi('${item.id}')">✎</button>
          <button class="btn-delete" onclick="deleteRetensi('${item.id}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editRetensi(id) {
  const item = retensiData.find(x => x.id === id);
  if (!item) return;

  editingRetensiId = id;
  document.getElementById('kategoriRetensi').value = item.kategori || '';
  document.getElementById('masaAktifRetensi').value = item.masaAktif || '';
  document.getElementById('masaInaktifRetensi').value = item.masaInaktif || '';
  document.getElementById('statusAkhirRetensi').value = item.statusAkhir || 'PERMANEN';
  document.getElementById('keteranganRetensi').value = item.keterangan || '';
  document.getElementById('btnSaveRetensi').textContent = 'Update Retensi';

  openRetensiForm();
}

function deleteRetensi(id) {
  showDeleteModal(
    'Hapus Retensi Arsip?',
    'Data retensi akan dihapus dari sistem dan Spreadsheet.',
    async function () {
      showSaveLoader('Menghapus Retensi', 'Data retensi sedang dihapus...');

      try {
        retensiData = retensiData.filter(function (item) {
          return item.id !== id;
        });

        localStorage.setItem('SIARDI_RETENSI', JSON.stringify(retensiData));

        await sendToSpreadsheet('DELETE_RETENSI', { id: id });

        renderRetensiTable();

        hideSaveLoader();
        showToast('Data retensi berhasil dihapus.', 'success');

      } catch (error) {
        hideSaveLoader();
        console.error(error);
        showToast('Data retensi gagal dihapus.', 'error');
      }
    }
  );
}

function clearRetensiForm() {
  editingRetensiId = null;
  document.getElementById('kategoriRetensi').value = '';
  document.getElementById('masaAktifRetensi').value = '';
  document.getElementById('masaInaktifRetensi').value = '';
  document.getElementById('statusAkhirRetensi').value = 'PERMANEN';
  document.getElementById('keteranganRetensi').value = '';
  document.getElementById('btnSaveRetensi').textContent = 'Simpan Retensi';
}

/* =========================
   PEMINJAMAN
========================= */

function openPeminjamanForm() {
  document.getElementById('peminjamanFormBox').classList.add('active');
}

async function savePeminjaman() {
  const arsipId = document.getElementById('idArsipPinjam').value.trim();
  const namaPeminjam = document.getElementById('namaPeminjam').value.trim();
  const unitPeminjam = document.getElementById('unitPeminjam').value.trim();
  const tanggalPinjam = document.getElementById('tanggalPinjam').value;
  const deadlineKembali = document.getElementById('deadlineKembali').value;
  const status = document.getElementById('statusPeminjaman').value;
  const keterangan = document.getElementById('keteranganPinjam').value.trim();

  if (!arsipId || !namaPeminjam || !tanggalPinjam || !deadlineKembali) {
    showToast('ID arsip, nama peminjam, tanggal pinjam, dan deadline wajib diisi.', 'warning');
    return;
  }

  showSaveLoader('Menyimpan Peminjaman', 'Data peminjaman sedang diproses...');

  try {
    let data;

    if (editingPeminjamanId) {
      const index = peminjamanData.findIndex(item => item.id === editingPeminjamanId);

      if (index !== -1) {
        data = {
          ...peminjamanData[index],
          arsipId,
          namaPeminjam,
          unitPeminjam,
          tanggalPinjam,
          deadlineKembali,
          status,
          keterangan
        };

        peminjamanData[index] = data;
      }
    } else {
      data = {
        id: 'PJM-' + String(Date.now()).slice(-5),
        arsipId,
        namaPeminjam,
        unitPeminjam,
        tanggalPinjam,
        deadlineKembali,
        status,
        keterangan
      };

      peminjamanData.push(data);
    }

    localStorage.setItem('SIARDI_PEMINJAMAN', JSON.stringify(peminjamanData));

    await sendToSpreadsheet('SAVE_PEMINJAMAN', data);

    clearPeminjamanForm();
    renderPeminjamanTable();
    autoUpdatePeminjamanStatus();

    hideSaveLoader();
    showToast(editingPeminjamanId ? 'Data peminjaman berhasil diperbarui.' : 'Data peminjaman berhasil disimpan.', 'success');

  } catch (error) {
    hideSaveLoader();
    console.error(error);
    showToast('Data peminjaman gagal disimpan.', 'error');
  }
}

function renderPeminjamanTable() {
  const tbody = document.getElementById('peminjamanTable');
  if (!tbody) return;

  if (!peminjamanData.length) {
    tbody.innerHTML = `<tr><td colspan="8">Belum ada data peminjaman arsip.</td></tr>`;
    return;
  }

  tbody.innerHTML = peminjamanData.map(item => `
    <tr>
      <td><b>${item.arsipId}</b></td>
      <td>${item.namaPeminjam}</td>
      <td>${item.unitPeminjam || '-'}</td>
      <td>${item.tanggalPinjam}</td>
      <td>${item.deadlineKembali}</td>
      <td><span class="role-badge">${item.status}</span></td>
      <td>${item.keterangan || '-'}</td>
      <td>
  <div class="action-group">
    ${
      item.status !== 'DIKEMBALIKAN'
        ? `<button class="btn-return" onclick="returnPeminjaman('${item.id}')">Kembalikan</button>`
        : ''
    }
    <button class="btn-edit" onclick="editPeminjaman('${item.id}')">✎</button>
    <button class="btn-delete" onclick="deletePeminjaman('${item.id}')">🗑</button>
  </div>
</td>
    </tr>
  `).join('');
}

function editPeminjaman(id) {
  const item = peminjamanData.find(x => x.id === id);
  if (!item) return;

  editingPeminjamanId = id;
  document.getElementById('idArsipPinjam').value = item.arsipId || '';
  document.getElementById('namaPeminjam').value = item.namaPeminjam || '';
  document.getElementById('unitPeminjam').value = item.unitPeminjam || '';
  document.getElementById('tanggalPinjam').value = item.tanggalPinjam || '';
  document.getElementById('deadlineKembali').value = item.deadlineKembali || '';
  document.getElementById('statusPeminjaman').value = item.status || 'DIPINJAM';
  document.getElementById('keteranganPinjam').value = item.keterangan || '';
  document.getElementById('btnSavePeminjaman').textContent = 'Update Peminjaman';

  openPeminjamanForm();
}

function deletePeminjaman(id) {
  showDeleteModal(
    'Hapus Data Peminjaman?',
    'Data peminjaman akan dihapus dari sistem dan Spreadsheet.',
    async function () {
      showSaveLoader('Menghapus Peminjaman', 'Data peminjaman sedang dihapus...');

      try {
        peminjamanData = peminjamanData.filter(function (item) {
          return item.id !== id;
        });

        localStorage.setItem('SIARDI_PEMINJAMAN', JSON.stringify(peminjamanData));

        await sendToSpreadsheet('DELETE_PEMINJAMAN', { id: id });

        renderPeminjamanTable();

        hideSaveLoader();
        showToast('Data peminjaman berhasil dihapus.', 'success');

      } catch (error) {
        hideSaveLoader();
        console.error(error);
        showToast('Data peminjaman gagal dihapus.', 'error');
      }
    }
  );
}

function clearPeminjamanForm() {
  editingPeminjamanId = null;
  document.getElementById('idArsipPinjam').value = '';
  document.getElementById('namaPeminjam').value = '';
  document.getElementById('unitPeminjam').value = '';
  document.getElementById('tanggalPinjam').value = '';
  document.getElementById('deadlineKembali').value = '';
  document.getElementById('statusPeminjaman').value = 'DIPINJAM';
  document.getElementById('keteranganPinjam').value = '';
  document.getElementById('btnSavePeminjaman').textContent = 'Simpan Peminjaman';
}

document.addEventListener('DOMContentLoaded', async function () {
  updateSyncStatus('syncing', 'Memuat Spreadsheet...');

  loadSystemSettings();
  registerSessionActivityEvents();

  /* Cek session dulu, jangan tunggu Spreadsheet */
  restoreSessionAfterRefresh();

  await loadArsipFromSpreadsheet();

  renderUserTable();
  renderRoleTable();
  renderUnitTable();
  renderKategoriTable();
  renderRetensiTable();
  renderPeminjamanTable();

  refreshInputMasterOptions();
  autoUpdatePeminjamanStatus();

  if (currentUser) {
    const savedPage = localStorage.getItem(CORE_LAST_PAGE_KEY);
    const defaultPage = systemSettings?.defaultPage || 'home';
    const targetPage = savedPage || defaultPage || 'home';
    const finalPage = canAccessPage(targetPage) ? targetPage : 'home';
    const activeBtn = getMenuButtonByPage(finalPage);

    showPage(finalPage, activeBtn);
  }
});

function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();

  const profile = getLoginProfile(username, password);

  if (profile) {
    currentUser = profile;
    localStorage.setItem('SIARDI_CURRENT_USER', JSON.stringify(currentUser));

    localStorage.setItem(CORE_SESSION_ACTIVITY_KEY, String(Date.now()));
    localStorage.setItem(CORE_LAST_PAGE_KEY, systemSettings?.defaultPage || 'home');

    updateHomeWelcome();

    const loadingTitle = document.getElementById("loadingTitle");
    const loadingText = document.getElementById("loadingText");

    if (loadingTitle) loadingTitle.textContent = "Memuat Dashboard";
    if (loadingText) loadingText.textContent = "Mohon tunggu sebentar...";

    document.body.classList.add("is-login");
    document.body.classList.remove("is-app");
    document.body.classList.remove("is-logout-loading");
    document.body.classList.add("is-loading");

        setTimeout(function () {
      document.body.classList.remove("is-loading");
      document.body.classList.remove("is-login");
      document.body.classList.add("is-app");

      applyRoleAccess();
      updateHomeWelcome();
      renderDashboard();
      renderRoleFocusPanel();

      const defaultPage = systemSettings.defaultPage || 'home';
      const activeBtn = document.querySelector(`.menu-single[onclick*="${defaultPage}"], .menu-sub button[onclick*="${defaultPage}"]`);

      showPage(defaultPage, activeBtn);

      updateSessionActivity();
      startIdleTimer();
    }, 1200);

  } else {
    showToast("Username atau password salah.", "warning");
  }
}

function logout() {
  const loadingTitle = document.getElementById("loadingTitle");
  const loadingText = document.getElementById("loadingText");

  // Hapus sesi user login
  clearCoreSession();

  if (loadingTitle) loadingTitle.textContent = "Keluar dari Sistem";
  if (loadingText) loadingText.textContent = "Mengakhiri sesi pengguna...";

  document.body.classList.remove("is-login");
  document.body.classList.add("is-app");
  document.body.classList.remove("is-loading");
  document.body.classList.add("is-logout-loading");

  setTimeout(function () {
  document.body.classList.remove("is-logout-loading");
  document.body.classList.remove("is-app");
  document.body.classList.add("is-login");

  document.getElementById("username").value = "admin";
  document.getElementById("password").value = "admin123";

  if (loadingTitle) loadingTitle.textContent = "Memuat Dashboard";
  if (loadingText) loadingText.textContent = "Mohon tunggu sebentar...";
}, 1000);
}

function showPage(page, btn = null) {

  if (!canAccessPage(page)) {
    showToast('Akses menu ini tidak tersedia untuk role Anda.', 'warning');
    return;
  }

  document.body.classList.toggle("is-home-page", page === "home");

  if (currentUser) {
  localStorage.setItem(CORE_LAST_PAGE_KEY, page);
  updateSessionActivity();
  startIdleTimer();
}
  const mainTopbar = document.getElementById("mainTopbar");

  if (mainTopbar) {
    mainTopbar.classList.toggle("home-topbar-hidden", page === "home");
  }

  document.querySelectorAll(".page").forEach(section => {
    section.classList.remove("active");
  });

  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add("active");
  }

  document.querySelectorAll(".menu-sub button, .menu-single").forEach(button => {
  button.classList.remove("active");
});

if (page === "input") {
  refreshInputMasterOptions();
}

  if (btn && btn.classList.contains('menu-parent') === false) {
  btn.classList.add("active");

  const parentGroup = btn.closest('.menu-group');
  if (parentGroup) {
    document.querySelectorAll('.menu-group').forEach(function (group) {
      group.classList.remove('open');
    });

    parentGroup.classList.add('open');
  }

} else {
  const activeButton = document.querySelector(`.menu-sub button[onclick*="'${page}'"], .menu-single[onclick*="'${page}'"]`);

  if (activeButton) {
    activeButton.classList.add("active");

    const parentGroup = activeButton.closest('.menu-group');
    if (parentGroup) {
      document.querySelectorAll('.menu-group').forEach(function (group) {
        group.classList.remove('open');
      });

      parentGroup.classList.add('open');
    }
  }
}

  const pageConfig = {

    home: {
      title: "Home",
      subtitle: "Halaman awal sistem arsip digital.",
      bannerClass: "banner-dashboard",
      bannerTitle: "Sistem Arsip Digital",
      bannerText: "Akses menu utama, master data, transaksi, laporan, dan pengaturan sistem."
    },

    dashboard: {
      title: "Dashboard Arsip",
      subtitle: "Monitoring data arsip, retensi, dan peminjaman.",
      bannerClass: "banner-dashboard",
      bannerTitle: "Dashboard Arsip Terintegrasi",
      bannerText: "Pantau data arsip, retensi, dan aktivitas sistem secara cepat."
    },
    arsip: {
      title: "Data Arsip",
      subtitle: "Daftar seluruh arsip digital yang tersimpan.",
      bannerClass: "banner-arsip",
      bannerTitle: "Data Arsip Digital",
      bannerText: "Kelola, telusuri, dan monitor seluruh dokumen arsip yang telah tersimpan."
    },
    input: {
      title: "Input Arsip",
      subtitle: "Tambah metadata dan file arsip baru.",
      bannerClass: "banner-input",
      bannerTitle: "Input Arsip Baru",
      bannerText: "Tambahkan data arsip secara cepat dan terstruktur ke dalam sistem."
    },
    user: {
      title: "Manajemen User",
      subtitle: "Kelola user, role, dan hak akses sistem.",
      bannerClass: "banner-user",
      bannerTitle: "Manajemen Pengguna",
      bannerText: "Atur pengguna sistem, role akses, dan otorisasi sesuai kebutuhan."
    },
    unit: {
      title: "Unit Kerja",
      subtitle: "Master unit kerja pemilik atau pengelola arsip.",
      bannerClass: "banner-unit",
      bannerTitle: "Master Unit Kerja",
      bannerText: "Kelola data unit kerja sebagai pemilik dan pengelola arsip digital."
    },
    "kategori-master": {
      title: "Kategori Arsip",
      subtitle: "Master klasifikasi dokumen arsip.",
      bannerClass: "banner-kategori",
      bannerTitle: "Kategori Arsip",
      bannerText: "Tentukan klasifikasi dan pengelompokan dokumen agar lebih rapi."
    },
    retensi: {
      title: "Retensi Arsip",
      subtitle: "Pengaturan masa simpan dan status akhir arsip.",
      bannerClass: "banner-retensi",
      bannerTitle: "Retensi Arsip",
      bannerText: "Atur masa aktif, masa inaktif, dan status akhir setiap jenis arsip."
    },
    peminjaman: {
      title: "Peminjaman Arsip",
      subtitle: "Monitoring dokumen yang sedang dipinjam.",
      bannerClass: "banner-peminjaman",
      bannerTitle: "Peminjaman Arsip",
      bannerText: "Monitor peminjaman, pengembalian, dan status keterlambatan dokumen."
    },
    laporan: {
      title: "Laporan Arsip",
      subtitle: "Filter dan export laporan arsip.",
      bannerClass: "banner-laporan",
      bannerTitle: "Laporan Arsip",
      bannerText: "Tampilkan rekap data arsip dan export laporan sesuai kebutuhan."
    },
    pengaturan: {
      title: "Pengaturan Sistem",
      subtitle: "Konfigurasi aplikasi dan preferensi tampilan.",
      bannerClass: "banner-pengaturan",
      bannerTitle: "Pengaturan Sistem",
      bannerText: "Sesuaikan konfigurasi aplikasi, tampilan, dan preferensi sistem."
    }
  };

  const config = pageConfig[page];

  if (config) {
    document.getElementById("pageTitle").textContent = config.title;
    document.getElementById("pageSubtitle").textContent = config.subtitle;

    const bannerTitle = document.getElementById("bannerTitle");
    const bannerText = document.getElementById("bannerText");

    if (bannerTitle) bannerTitle.textContent = config.bannerTitle;
    if (bannerText) bannerText.textContent = config.bannerText;
  }

    const topbar = document.getElementById("mainTopbar");
    const banner = document.getElementById("menuBanner");

    if (topbar && banner && config) {
      banner.className = `menu-banner active ${config.bannerClass}`;

      if (page === "dashboard") {
        topbar.classList.add("dashboard-topbar");
      } else {
        topbar.classList.remove("dashboard-topbar");
      }
    }

  if (page === "arsip") {
  initArchiveFilters();
  filterArchive(true);
}
  if (page === "user") renderUserTable();
  if (page === "role") renderRoleTable();
  if (page === "unit") renderUnitTable();
  if (page === "kategori-master") renderKategoriTable();
  if (page === "retensi") renderRetensiTable();
  if (page === "peminjaman") renderPeminjamanTable();

  if (page === "home") {
  updateHomeWelcome();
  renderDashboard();

  if (typeof renderRoleFocusPanel === 'function') {
    renderRoleFocusPanel();
  }
}

  openFormByPage(page);
}

function openFormByPage(page) {
  const formMap = {
  user: 'userFormBox',
  role: 'roleFormBox',
  unit: 'unitFormBox',
  'kategori-master': 'kategoriFormBox',
  retensi: 'retensiFormBox',
  peminjaman: 'peminjamanFormBox'
};

  // Tutup semua form master/transaksi dulu
  Object.values(formMap).forEach(function(formId) {
    const formBox = document.getElementById(formId);
    if (formBox) {
      formBox.classList.remove('active');
    }
  });

  // Buka form sesuai menu yang diklik
  const targetFormId = formMap[page];
  if (targetFormId) {
    const targetForm = document.getElementById(targetFormId);
    if (targetForm) {
      targetForm.classList.add('active');
    }
  }
}

function renderAll() {
  localStorage.setItem('SIARDI_DATA', JSON.stringify(arsipData));

  renderDashboard();
  renderRoleFocusPanel();

  currentArchiveRows = arsipData;
  renderTable(currentArchiveRows);

  renderCharts();
}

// =========================
// DATA STORAGE
// =========================


// =========================
// FUNGSI SIMPAN USER
// =========================

let editingUserId = null;

function openUserForm() {
  document.getElementById('userFormBox').classList.add('active');
}

function closeUserForm() {
  document.getElementById('userFormBox').classList.remove('active');
}

async function saveUser() {
  const nama = document.getElementById('namaUser').value.trim();
  const username = document.getElementById('usernameUser').value.trim();
  const role = document.getElementById('roleUser').value;
  const divisi = document.getElementById('divisiUser').value.trim();
  const status = document.getElementById('statusUser').value;
  const keterangan = document.getElementById('keteranganUser').value.trim();

  if (!nama || !username) {
    showToast('Nama lengkap dan username wajib diisi.', 'warning');
    return;
  }

  showSaveLoader('Menyimpan User', 'Data user sedang diproses...');

  try {
    let data;

    if (editingUserId) {
      const index = userData.findIndex(item => item.id === editingUserId);

      if (index !== -1) {
        data = {
          ...userData[index],
          nama,
          username,
          role,
          divisi,
          status,
          keterangan
        };

        userData[index] = data;
      }
    } else {
      data = {
        id: 'USR-' + String(Date.now()).slice(-5),
        nama,
        username,
        role,
        divisi,
        status,
        keterangan
      };

      userData.push(data);
    }

    localStorage.setItem('SIARDI_USERS', JSON.stringify(userData));

    await sendToSpreadsheet('SAVE_USER', data);

    clearUserForm();
    renderUserTable();
    closeUserForm();

    hideSaveLoader();
    showToast(editingUserId ? 'Data user berhasil diperbarui.' : 'Data user berhasil disimpan.', 'success');

  } catch (error) {
    hideSaveLoader();
    console.error(error);
    showToast('Data user gagal disimpan.', 'error');
  }
}

function renderUserTable() {
  const tbody = document.getElementById('userTable');

  if (!tbody) return;

  if (!userData.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">Belum ada data user yang tersimpan.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = userData.map(function (item) {
    return `
      <tr>
        <td><b>${item.nama}</b></td>
        <td>${item.username}</td>
        <td>
          <span class="role-badge">${item.role || '-'}</span>
        </td>
        <td>
          <span class="divisi-badge">${item.divisi || '-'}</span>
        </td>
        <td>
          <span class="status-badge ${String(item.status).toLowerCase()}">
            ${item.status || '-'}
          </span>
          <br>
          <small>${item.keterangan || '-'}</small>
        </td>
        <td>
          <div class="action-group">
            <button class="btn-edit" onclick="editUser('${item.id}')">✎</button>
            <button class="btn-delete" onclick="deleteUser('${item.id}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editUser(id) {
  const user = userData.find(item => item.id === id);

  if (!user) return;

  editingUserId = id;

  document.getElementById('namaUser').value = user.nama || '';
  document.getElementById('usernameUser').value = user.username || '';
  document.getElementById('roleUser').value = user.role || 'Super Admin';
  document.getElementById('divisiUser').value = user.divisi || '';
  document.getElementById('statusUser').value = user.status || 'Aktif';
  document.getElementById('keteranganUser').value = user.keterangan || '';

  document.getElementById('btnSaveUser').textContent = 'Update User';

  openUserForm();
}

function deleteUser(id) {
  showDeleteModal(
    'Hapus User?',
    'User akan dihapus dari sistem dan Spreadsheet.',
    async function () {
      showSaveLoader('Menghapus User', 'Data user sedang dihapus...');

      try {
        userData = userData.filter(function (item) {
          return item.id !== id;
        });

        localStorage.setItem('SIARDI_USERS', JSON.stringify(userData));

        await sendToSpreadsheet('DELETE_USER', { id: id });

        renderUserTable();

        hideSaveLoader();
        showToast('Data user berhasil dihapus.', 'success');

      } catch (error) {
        hideSaveLoader();
        console.error(error);
        showToast('Data user gagal dihapus.', 'error');
      }
    }
  );
}

function clearUserForm() {
  editingUserId = null;

  document.getElementById('namaUser').value = '';
  document.getElementById('usernameUser').value = '';
  document.getElementById('roleUser').value = 'Super Admin';
  document.getElementById('divisiUser').value = '';
  document.getElementById('statusUser').value = 'Aktif';
  document.getElementById('keteranganUser').value = '';

  const btn = document.getElementById('btnSaveUser');
  if (btn) btn.textContent = 'Simpan User';
}

function renderDashboard() {
  const total = arsipData.length;
  const aktif = countStatus('AKTIF');
  const inaktif = countStatus('INAKTIF');
  const permanen = countStatus('PERMANEN');
  const musnah = countStatus('MUSNAH');

  const totalArsip = document.getElementById('totalArsip');
  const arsipAktif = document.getElementById('arsipAktif');
  const arsipInaktif = document.getElementById('arsipInaktif');
  const arsipPermanen = document.getElementById('arsipPermanen');

  if (totalArsip) totalArsip.textContent = total;
  if (arsipAktif) arsipAktif.textContent = aktif;
  if (arsipInaktif) arsipInaktif.textContent = inaktif;
  if (arsipPermanen) arsipPermanen.textContent = permanen;

  const homeTotalArsip = document.getElementById('homeTotalArsip');
  const homeStatTotal = document.getElementById('homeStatTotal');
  const homeStatAktif = document.getElementById('homeStatAktif');
  const homeStatInaktif = document.getElementById('homeStatInaktif');
  const homeStatPermanen = document.getElementById('homeStatPermanen');
  const homeChartTotal = document.getElementById('homeChartTotal');

  const legendAktif = document.getElementById('legendAktif');
  const legendInaktif = document.getElementById('legendInaktif');
  const legendPermanen = document.getElementById('legendPermanen');
  const legendMusnah = document.getElementById('legendMusnah');

  if (homeTotalArsip) homeTotalArsip.textContent = `${total} Arsip`;
  if (homeStatTotal) homeStatTotal.textContent = total;
  if (homeStatAktif) homeStatAktif.textContent = aktif;
  if (homeStatInaktif) homeStatInaktif.textContent = inaktif;
  if (homeStatPermanen) homeStatPermanen.textContent = permanen;
  if (homeChartTotal) homeChartTotal.textContent = total;

  if (legendAktif) legendAktif.textContent = `${aktif} Arsip`;
  if (legendInaktif) legendInaktif.textContent = `${inaktif} Arsip`;
  if (legendPermanen) legendPermanen.textContent = `${permanen} Arsip`;
  if (legendMusnah) legendMusnah.textContent = `${musnah} Arsip`;

  const homeWelcomeTitle = document.getElementById('homeWelcomeTitle');
  const homeWelcomeSmall = document.getElementById('homeWelcomeSmall');

  if (currentUser) {
    if (homeWelcomeSmall) {
      homeWelcomeSmall.textContent = `Selamat datang, ${currentUser.nama}.`;
    }

    if (homeWelcomeTitle) {
      homeWelcomeTitle.textContent = 'COREARSIP siap membantu pengelolaan arsip digital Anda.';
    }
  }

  renderCorePortalInfo();
}

function renderTopInsight() {
  const roleEl = document.getElementById('topInsightRole');
  const totalEl = document.getElementById('topInsightTotal');
  const aktifEl = document.getElementById('topInsightAktif');
  const pinjamEl = document.getElementById('topInsightPinjam');

  const total = arsipData.length;
  const aktif = countStatus('AKTIF');

  const pinjamAktif = peminjamanData.filter(function (item) {
    return item.status !== 'DIKEMBALIKAN';
  }).length;

  if (roleEl) roleEl.textContent = currentUser ? currentUser.role : '-';
  if (totalEl) totalEl.textContent = total;
  if (aktifEl) aktifEl.textContent = aktif;
  if (pinjamEl) pinjamEl.textContent = pinjamAktif;
}

function countStatus(status) {
  return arsipData.filter(function (item) {
    return item.status === status;
  }).length;
}

function renderTable(data) {
  const tbody = document.getElementById('archiveTable');
  const paginationBox = document.getElementById('archivePagination');

  if (!tbody) return;

  const sourceData = Array.isArray(data) ? data : arsipData;
  const perPage = 6;
  const totalRows = sourceData.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / perPage));

  if (!tablePagination.arsip) {
    tablePagination.arsip = { page: 1, perPage: perPage };
  }

  tablePagination.arsip.perPage = perPage;

  if (tablePagination.arsip.page > totalPages) {
    tablePagination.arsip.page = totalPages;
  }

  if (tablePagination.arsip.page < 1) {
    tablePagination.arsip.page = 1;
  }

  const start = (tablePagination.arsip.page - 1) * perPage;
  const rows = sourceData.slice(start, start + perPage);

  if (!totalRows) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9">Data arsip tidak ditemukan.</td>
      </tr>
    `;

    if (paginationBox) paginationBox.innerHTML = '';
    return;
  }

  tbody.innerHTML = rows.map(function (item) {
    return `
      <tr>
        <td>${item.id}</td>
        <td>${item.nomor}</td>
        <td><b>${item.judul}</b></td>
        <td>${item.kategori}</td>
        <td>${item.unit}</td>
        <td>${item.tahun}</td>
        <td>${badge(item.status)}</td>
        <td>${renderArchiveFileCell(item)}</td>
        <td>
          <button class="mini-btn" onclick="deleteArchive('${item.id}')">Hapus</button>
        </td>
      </tr>
    `;
  }).join('');

  if (paginationBox) {
    let html = `
      <span class="pagination-info">
        ${totalRows} data • Halaman ${tablePagination.arsip.page} dari ${totalPages}
      </span>
    `;

    html += `
      <button onclick="goArchivePage(${tablePagination.arsip.page - 1})" ${tablePagination.arsip.page === 1 ? 'disabled' : ''}>
        ‹
      </button>
    `;

    for (let i = 1; i <= totalPages; i++) {
      html += `
        <button class="${i === tablePagination.arsip.page ? 'active' : ''}" onclick="goArchivePage(${i})">
          ${i}
        </button>
      `;
    }

    html += `
      <button onclick="goArchivePage(${tablePagination.arsip.page + 1})" ${tablePagination.arsip.page === totalPages ? 'disabled' : ''}>
        ›
      </button>
    `;

    paginationBox.innerHTML = html;
  }
}

function goArchivePage(page) {
  const perPage = 6;
  const data = currentArchiveRows && currentArchiveRows.length ? currentArchiveRows : arsipData;
  const totalPages = Math.max(1, Math.ceil(data.length / perPage));

  if (page < 1) page = 1;
  if (page > totalPages) page = totalPages;

  tablePagination.arsip.page = page;
  tablePagination.arsip.perPage = perPage;

  renderTable(data);
}

function badge(status) {
  return `<span class="badge ${status.toLowerCase()}">${status}</span>`;
}

function searchArchive() {
  resetTablePage('arsip');

  const arsipButton = document.querySelector(`.menu-sub button[onclick*="'arsip'"]`);
  showPage('arsip', arsipButton);

  filterArchive(true);
}

function initArchiveFilters() {
  fillArchiveSelect('filterKategori', 'kategori', 'Semua Kategori');
  fillArchiveSelect('filterUnit', 'unit', 'Semua Unit');
  fillArchiveSelect('filterTahun', 'tahun', 'Semua Tahun');
}

function fillArchiveSelect(selectId, fieldName, defaultText) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const currentValue = select.value;

  const values = [...new Set(
    arsipData
      .map(item => item[fieldName])
      .filter(value => value !== undefined && value !== null && String(value).trim() !== '')
  )].sort();

  select.innerHTML = `<option value="">${defaultText}</option>`;

  values.forEach(value => {
    select.innerHTML += `<option value="${value}">${value}</option>`;
  });

  select.value = currentValue;
}

function filterArchive(resetPage = true) {
  if (resetPage) resetTablePage('arsip');

  const kategori = document.getElementById('filterKategori')?.value || '';
  const unit = document.getElementById('filterUnit')?.value || '';
  const tahun = document.getElementById('filterTahun')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const keyword = document.getElementById('searchInput')?.value.toLowerCase() || '';

  currentArchiveRows = arsipData.filter(function (item) {
    const matchKategori = !kategori || item.kategori === kategori;
    const matchUnit = !unit || item.unit === unit;
    const matchTahun = !tahun || String(item.tahun) === String(tahun);
    const matchStatus = !status || item.status === status;

    const matchKeyword =
      !keyword ||
      String(item.nomor).toLowerCase().includes(keyword) ||
      String(item.judul).toLowerCase().includes(keyword) ||
      String(item.kategori).toLowerCase().includes(keyword) ||
      String(item.unit).toLowerCase().includes(keyword) ||
      String(item.tahun).includes(keyword);

    return matchKategori && matchUnit && matchTahun && matchStatus && matchKeyword;
  });

  renderTable(currentArchiveRows);
}

function forceRenderArchivePagination() {
  const kategori = document.getElementById('filterKategori')?.value || '';
  const unit = document.getElementById('filterUnit')?.value || '';
  const tahun = document.getElementById('filterTahun')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';

  currentArchiveRows = arsipData.filter(function (item) {
    const matchKategori = !kategori || item.kategori === kategori;
    const matchUnit = !unit || item.unit === unit;
    const matchTahun = !tahun || String(item.tahun) === String(tahun);
    const matchStatus = !status || item.status === status;

    return matchKategori && matchUnit && matchTahun && matchStatus;
  });

  renderTable(currentArchiveRows);
  renderPagination('arsip', currentArchiveRows.length);
}

function resetArchiveFilter() {
  const filterKategori = document.getElementById('filterKategori');
  const filterUnit = document.getElementById('filterUnit');
  const filterTahun = document.getElementById('filterTahun');
  const filterStatus = document.getElementById('filterStatus');
  const searchInput = document.getElementById('searchInput');

  if (filterKategori) filterKategori.value = '';
  if (filterUnit) filterUnit.value = '';
  if (filterTahun) filterTahun.value = '';
  if (filterStatus) filterStatus.value = '';
  if (searchInput) searchInput.value = '';

  resetTablePage('arsip');

  currentArchiveRows = arsipData;
  renderTable(currentArchiveRows);
}

/* =========================================================
   PENYIMPANAN FILE ARSIP - INDEXED DB
========================================================= */

const ARCHIVE_DB_NAME = 'COREARSIP_FILE_DB';
const ARCHIVE_DB_VERSION = 1;
const ARCHIVE_FILE_STORE = 'archiveFiles';

function openArchiveDB() {
  return new Promise(function (resolve, reject) {
    const request = indexedDB.open(
      ARCHIVE_DB_NAME,
      ARCHIVE_DB_VERSION
    );

    request.onupgradeneeded = function (event) {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(ARCHIVE_FILE_STORE)) {
        database.createObjectStore(ARCHIVE_FILE_STORE, {
          keyPath: 'id'
        });
      }
    };

    request.onsuccess = function () {
      resolve(request.result);
    };

    request.onerror = function () {
      reject(
        request.error ||
        new Error('Database file arsip tidak dapat dibuka.')
      );
    };
  });
}

/* =========================================================
   FILE UPLOAD HELPER
========================================================= */

function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();

    reader.onload = function () {
      const result = String(reader.result || '');
      const base64 = result.includes(',')
        ? result.split(',')[1]
        : result;

      resolve(base64);
    };

    reader.onerror = function () {
      reject(
        reader.error ||
        new Error('File gagal dibaca.')
      );
    };

    reader.readAsDataURL(file);
  });
}

function normalizeRetensiText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getRetensiByKategori(kategori) {
  const target = normalizeRetensiText(kategori);

  return retensiData.find(function (item) {
    return normalizeRetensiText(
      item.kategori || item.kategoriRetensi
    ) === target;
  }) || null;
}

function getCurrentUserName() {
  return (
    currentUser?.nama ||
    currentUser?.username ||
    'Administrator'
  );
}

async function saveArchiveFile(archiveId, file) {
  const database = await openArchiveDB();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      ARCHIVE_FILE_STORE,
      'readwrite'
    );

    const store = transaction.objectStore(ARCHIVE_FILE_STORE);

    store.put({
      id: archiveId,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      lastModified: file.lastModified,
      blob: file
    });

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      database.close();

      reject(
        transaction.error ||
        new Error('File arsip gagal disimpan.')
      );
    };

    transaction.onabort = function () {
      database.close();

      reject(
        transaction.error ||
        new Error('Penyimpanan file arsip dibatalkan.')
      );
    };
  });
}

async function getArchiveFile(archiveId) {
  const database = await openArchiveDB();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      ARCHIVE_FILE_STORE,
      'readonly'
    );

    const store = transaction.objectStore(ARCHIVE_FILE_STORE);
    const request = store.get(archiveId);

    request.onsuccess = function () {
      database.close();
      resolve(request.result || null);
    };

    request.onerror = function () {
      database.close();

      reject(
        request.error ||
        new Error('File arsip tidak dapat ditemukan.')
      );
    };
  });
}

async function deleteArchiveFile(archiveId) {
  const database = await openArchiveDB();

  return new Promise(function (resolve, reject) {
    const transaction = database.transaction(
      ARCHIVE_FILE_STORE,
      'readwrite'
    );

    const store = transaction.objectStore(ARCHIVE_FILE_STORE);
    store.delete(archiveId);

    transaction.oncomplete = function () {
      database.close();
      resolve();
    };

    transaction.onerror = function () {
      database.close();

      reject(
        transaction.error ||
        new Error('File arsip gagal dihapus.')
      );
    };
  });
}

async function openArchiveFile(archiveId) {
  /* Dibuka langsung agar tidak diblokir pop-up browser */
  const previewWindow = window.open('', '_blank');

  if (!previewWindow) {
    showToast(
      'Izinkan pop-up browser untuk membuka file arsip.',
      'warning'
    );
    return;
  }

  previewWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Memuat File Arsip</title>
      </head>
      <body style="
        margin:0;
        min-height:100vh;
        display:grid;
        place-items:center;
        font-family:Arial,sans-serif;
        color:#17245a;
        background:#eef3fb;
      ">
        <div>Memuat file arsip...</div>
      </body>
    </html>
  `);

  try {
    const storedFile = await getArchiveFile(archiveId);

    if (!storedFile || !storedFile.blob) {
      previewWindow.close();

      showToast(
        'File tidak ditemukan. Data lama perlu diunggah ulang.',
        'warning'
      );
      return;
    }

    const fileUrl = URL.createObjectURL(storedFile.blob);

    previewWindow.location.href = fileUrl;

    /* Bersihkan temporary URL setelah lima menit */
    window.setTimeout(function () {
      URL.revokeObjectURL(fileUrl);
    }, 300000);

  } catch (error) {
    previewWindow.close();
    console.error(error);

    showToast(
      'File arsip tidak dapat dibuka.',
      'error'
    );
  }
}

function escapeArchiveHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function renderArchiveFileCell(item) {
  if (item.linkFile) {
    return `
      <button
        type="button"
        class="archive-file-open"
        onclick="openDriveArchiveFile('${escapeArchiveHTML(item.id)}')"
        title="Buka file arsip"
      >
        <span>📎</span>
        <span>
          ${escapeArchiveHTML(item.file || 'Buka File')}
        </span>
      </button>
    `;
  }

  if (
    item.file &&
    item.file !== '-'
  ) {
    return `
      <span
        class="archive-file-old"
        title="File lama belum tersimpan di Google Drive."
      >
        📄 ${escapeArchiveHTML(item.file)}
      </span>
    `;
  }

  return '-';
}

function openDriveArchiveFile(archiveId) {
  const item = arsipData.find(function (data) {
    return String(data.id) === String(archiveId);
  });

  if (!item?.linkFile) {
    showToast(
      'Link file belum tersedia.',
      'warning'
    );

    return;
  }

  window.open(
    item.linkFile,
    '_blank',
    'noopener,noreferrer'
  );
}

async function saveArchive(event) {
  event.preventDefault();

  const nomor = document
    .getElementById('nomorArsip')
    .value
    .trim();

  const judul = document
    .getElementById('judulArsip')
    .value
    .trim();

  const kategori =
    document.getElementById('kategori').value;

  const unit =
    document.getElementById('unitKerja').value;

  const tahun =
    document.getElementById('tahun').value;

  const status =
    document.getElementById('statusRetensi').value;

  const tanggalArsip =
    document.getElementById('tanggalArsip')
      ?.value || '';

  const lokasiFisik =
    document.getElementById('lokasiFisik')
      ?.value
      .trim() || '';

  const kataKunci =
    document.getElementById('kataKunciArsip')
      ?.value
      .trim() || judul;

  const keterangan =
    document.getElementById('keteranganArsip')
      ?.value
      .trim() || '';

  const keamanan =
    document.getElementById('keamananArsip')
      ?.value || 'INTERNAL';

  const tanggalEvaluasiRetensi =
    document.getElementById('tanggalEvaluasiRetensi')
      ?.value || '';

  if (
    !nomor ||
    !judul ||
    !kategori ||
    !unit ||
    !tahun ||
    !tanggalArsip
  ) {
    showToast(
      'Nomor, judul, kategori, unit, tahun, dan tanggal arsip wajib diisi.',
      'warning'
    );

    return;
  }

  const fileInput =
    document.getElementById('fileArsip');

  const selectedFile =
    fileInput?.files?.[0] || null;

  /*
   * Base64 menambah ukuran file.
   * Batas 8 MB lebih aman untuk Apps Script Web App.
   */
  const maximumFileSize =
    8 * 1024 * 1024;

  if (
    selectedFile &&
    selectedFile.size > maximumFileSize
  ) {
    showToast(
      'Ukuran file maksimal 8 MB.',
      'warning'
    );

    return;
  }

  const archiveId =
    'ARS-' + String(Date.now()).slice(-6);

  const retensiRule =
    getRetensiByKategori(kategori);

  showSaveLoader(
    'Menyimpan Arsip',
    selectedFile
      ? 'File sedang diunggah ke Google Drive...'
      : 'Metadata arsip sedang disimpan...'
  );

  try {
    let fileData = '';

    if (selectedFile) {
      fileData = await fileToBase64(
        selectedFile
      );
    }

    const payload = {
      id: archiveId,
      nomor: nomor,
      judul: judul,
      kategori: kategori,
      unit: unit,
      tahun: tahun,
      tanggalArsip: tanggalArsip,

      retensiAktif:
        retensiRule?.masaAktif || '',

      retensiInaktif:
        retensiRule?.masaInaktif || '',

      nasibAkhir:
        retensiRule?.statusAkhir || '',

      status: status,
      lokasiFisik: lokasiFisik,
      statusPinjam: 'TERSEDIA',

      petugasInput:
        getCurrentUserName(),

      kataKunci: kataKunci,
      keterangan: keterangan,

      keamanan: keamanan,

      tanggalEvaluasiRetensi:
        tanggalEvaluasiRetensi,

      workflowStatus: 'AKTIF',

      fileName:
        selectedFile?.name || '',

      fileMimeType:
        selectedFile?.type ||
        'application/octet-stream',

      fileSize:
        selectedFile?.size || 0,

      fileData: fileData
    };

    const response = await sendToSpreadsheet(
      'SAVE_ARSIP',
      payload
    );

    /*
     * Struktur respons:
     * response.data       = hasil saveArsip()
     * response.data.data  = isi baris Spreadsheet
     */
    const savedRow =
      response?.data?.data || {};

    const newData = {
      id:
        savedRow.ID_ARSIP ||
        archiveId,

      nomor:
        savedRow.NOMOR_ARSIP ||
        nomor,

      judul:
        savedRow.JUDUL_ARSIP ||
        judul,

      kategori:
        savedRow.KATEGORI ||
        kategori,

      unit:
        savedRow.UNIT_KERJA ||
        unit,

      tahun:
        savedRow.TAHUN ||
        tahun,

      tanggalArsip:
        savedRow.TANGGAL_ARSIP ||
        tanggalArsip,

      retensiAktif:
        savedRow.RETENSI_AKTIF ||
        retensiRule?.masaAktif ||
        '',

      retensiInaktif:
        savedRow.RETENSI_INAKTIF ||
        retensiRule?.masaInaktif ||
        '',

      nasibAkhir:
        savedRow.NASIB_AKHIR ||
        retensiRule?.statusAkhir ||
        '',

      status:
        savedRow.STATUS_RETENSI ||
        status,

      lokasiFisik:
        savedRow.LOKASI_FISIK ||
        lokasiFisik,

      linkFile:
        savedRow.LINK_FILE || '',

      fileId:
        savedRow.FILE_ID || '',

      file:
        savedRow.NAMA_FILE ||
        selectedFile?.name ||
        '-',

      hasFile:
        Boolean(savedRow.FILE_ID),

      keamanan:
        savedRow.KLASIFIKASI_KEAMANAN ||
        keamanan,

      tanggalEvaluasiRetensi:
        savedRow.TANGGAL_EVALUASI_RETENSI ||
        tanggalEvaluasiRetensi,

      workflowStatus:
        savedRow.WORKFLOW_STATUS ||
        'AKTIF',

      kataKunci:
        savedRow.KATA_KUNCI ||
        kataKunci,

      keterangan:
        savedRow.KETERANGAN ||
        keterangan
    };

    arsipData.push(newData);

    localStorage.setItem(
      'SIARDI_DATA',
      JSON.stringify(arsipData)
    );

    document
      .getElementById('archiveForm')
      .reset();

    const keamananInput =
      document.getElementById('keamananArsip');

    if (keamananInput) {
      keamananInput.value = 'INTERNAL';
    }

    resetTablePage('arsip');

    currentArchiveRows =
      typeof canAccessArchive === 'function'
        ? arsipData.filter(canAccessArchive)
        : arsipData;

    renderAll();
    initArchiveFilters();

    if (
      typeof refreshPenyusutanArsipOptions ===
      'function'
    ) {
      refreshPenyusutanArsipOptions();
    }

    if (
      typeof buildAutomaticNotifications ===
      'function'
    ) {
      buildAutomaticNotifications();
    }

    const arsipButton =
      document.querySelector(
        `.menu-sub button[onclick*="'arsip'"]`
      );

    showPage('arsip', arsipButton);

    hideSaveLoader();

    showToast(
      selectedFile
        ? 'Data dan file berhasil disimpan ke Spreadsheet dan Google Drive.'
        : 'Data arsip berhasil disimpan.',
      'success'
    );

  } catch (error) {
    hideSaveLoader();

    console.error(
      'Gagal menyimpan arsip:',
      error
    );

    showToast(
      error.message ||
      'Data atau file arsip gagal disimpan.',
      'error'
    );
  }
}

function defaultRoleAccounts() {
  return [
    {
      id: 'ROLE-001',
      nama: 'Administrator Demo',
      username: 'admin',
      password: 'admin123',
      role: 'Super Admin',
      status: 'Aktif',
      keterangan: 'Akun utama sistem'
    },
    {
      id: 'ROLE-002',
      nama: 'Admin Arsip',
      username: 'admin2',
      password: 'admin234',
      role: 'Admin',
      status: 'Aktif',
      keterangan: 'Akun admin arsip'
    },
    {
      id: 'ROLE-003',
      nama: 'Operator Arsip',
      username: 'operator',
      password: 'operator123',
      role: 'Operator Arsip',
      status: 'Aktif',
      keterangan: 'Akun operator arsip'
    },
    {
      id: 'ROLE-004',
      nama: 'Viewer Arsip',
      username: 'viewer',
      password: 'viewer123',
      role: 'Viewer',
      status: 'Aktif',
      keterangan: 'Akun viewer laporan'
    }
  ];
}

let roleAccountData = JSON.parse(localStorage.getItem('SIARDI_ROLE_ACCOUNTS')) || defaultRoleAccounts();
let editingRoleId = null;

localStorage.setItem('SIARDI_ROLE_ACCOUNTS', JSON.stringify(roleAccountData));

function deleteArchive(id) {
  showDeleteModal(
    'Hapus Data Arsip?',
    'Data arsip akan dihapus dari tampilan dan dikirim ke Spreadsheet.',
    async function () {
      showSaveLoader('Menghapus Arsip', 'Data sedang dihapus dari sistem...');

      try {

        await deleteArchiveFile(id);

        arsipData = arsipData.filter(function (item) {
          return item.id !== id;
        });

        localStorage.setItem('SIARDI_DATA', JSON.stringify(arsipData));

        await sendToSpreadsheet('DELETE_ARSIP', { id: id });

        renderAll();

        hideSaveLoader();
        showToast('Data arsip berhasil dihapus.', 'success');

      } catch (error) {
        hideSaveLoader();
        console.error(error);
        showToast('Data arsip gagal dihapus.', 'error');
      }
    }
  );
}

function renderCharts() {
  const kategoriCount = {};
  const statusCount = {
    AKTIF: 0,
    INAKTIF: 0,
    PERMANEN: 0,
    MUSNAH: 0
  };

  arsipData.forEach(function(item) {
    kategoriCount[item.kategori] = (kategoriCount[item.kategori] || 0) + 1;
    statusCount[item.status] = (statusCount[item.status] || 0) + 1;
  });

  const kategoriLabels = Object.keys(kategoriCount);
  const kategoriValues = Object.values(kategoriCount);

  Highcharts.chart('categoryChart3D', {
    chart: {
      type: 'column',
      backgroundColor: 'transparent',
      options3d: {
      enabled: true,
      alpha: 0,
      beta: 0,
      depth: 40,
      viewDistance: 25
    }
    },
    title: {
      text: null
    },
    credits: {
      enabled: false
    },
    xAxis: {
      categories: kategoriLabels,
      labels: {
        style: {
          color: '#44506b',
          fontWeight: '600'
        }
      },
      lineColor: '#cfd7ea',
      tickColor: '#cfd7ea'
    },
    yAxis: {
      min: 0,
      title: {
        text: null
      },
      gridLineColor: 'rgba(23, 36, 90, 0.12)',
      labels: {
        style: {
          color: '#44506b',
          fontWeight: '600'
        }
      }
    },
    legend: {
      enabled: false
    },
    plotOptions: {
      column: {
        depth: 35,
        borderWidth: 0,
        colorByPoint: true,
        colors: ['#5B52F0', '#7167FF', '#4A90E2', '#7C6CFF', '#9A84FF'],
        dataLabels: {
          enabled: true,
          style: {
            color: '#ffffff',
            textOutline: 'none',
            fontWeight: '700'
          }
        }
      }
    },
    tooltip: {
      backgroundColor: '#17245a',
      style: {
        color: '#ffffff'
      },
      pointFormat: '<b>{point.y}</b> arsip'
    },
    series: [{
      name: 'Jumlah Arsip',
      data: kategoriValues
    }]
  });

  Highcharts.chart('statusChart3D', {
    chart: {
      type: 'pie',
      backgroundColor: 'transparent',
      options3d: {
        enabled: true,
        alpha: 50,
        beta: 0
      }
    },
    title: {
      text: null
    },
    credits: {
      enabled: false
    },
    tooltip: {
      backgroundColor: '#17245a',
      style: {
        color: '#ffffff'
      },
      pointFormat: '<b>{point.percentage:.1f}%</b><br>Jumlah: {point.y}'
    },
    legend: {
      enabled: true,
      itemStyle: {
        color: '#ffffff',
        fontWeight: '600'
      }
    },
    plotOptions: {
      pie: {
        innerSize: 110,
        depth: 45,
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: true,
          format: '{point.name}<br>{point.percentage:.1f}%',
          style: {
            color: '#ffffff',
            textOutline: 'none',
            fontWeight: '700'
          }
        },
        showInLegend: true
      }
    },
    series: [{
      name: 'Status',
      data: [
        { name: 'AKTIF', y: statusCount.AKTIF, color: '#20B26B' },
        { name: 'INAKTIF', y: statusCount.INAKTIF, color: '#F2A81D' },
        { name: 'PERMANEN', y: statusCount.PERMANEN, color: '#7167FF' },
        { name: 'MUSNAH', y: statusCount.MUSNAH, color: '#E25568' }
      ]
    }]
  });
}

function toggleMenuGroup(parentButton) {
  const currentGroup = parentButton.closest('.menu-group');

  if (!currentGroup) return;

  const isOpen = currentGroup.classList.contains('open');

  closeAllMenuGroups();

  if (!isOpen) {
    currentGroup.classList.add('open');
  }
}

/* =========================
   MASTER DATA TO INPUT ARSIP
========================= */

const defaultKategoriArsip = [
  'Surat Masuk',
  'Surat Keluar',
  'Surat Keputusan',
  'Laporan',
  'Berita Acara',
  'JRA',
  'Formulir'
];

function refreshInputMasterOptions() {
  refreshKategoriInputOptions();
  refreshUnitInputOptions();
}

function refreshKategoriInputOptions() {
  const select = document.getElementById('kategori');
  if (!select) return;

  const currentValue = select.value;

  const kategoriAktif = kategoriData
    .filter(item => !item.status || item.status === 'Aktif')
    .map(item => item.nama)
    .filter(Boolean);

  const finalKategori = [...new Set([...defaultKategoriArsip, ...kategoriAktif])];

  select.innerHTML = '<option value="">Pilih kategori</option>';

  finalKategori.forEach(function (nama) {
    select.innerHTML += `<option value="${nama}">${nama}</option>`;
  });

  select.value = currentValue;
}

function refreshUnitInputOptions() {
  const select = document.getElementById('unitKerja');
  if (!select) return;

  const currentValue = select.value;

  const unitAktif = unitData
    .filter(item => !item.status || item.status === 'Aktif')
    .map(item => item.nama)
    .filter(Boolean);

  select.innerHTML = '<option value="">Pilih unit kerja</option>';

  unitAktif.forEach(function (nama) {
    select.innerHTML += `<option value="${nama}">${nama}</option>`;
  });

  if (!unitAktif.length) {
    select.innerHTML += '<option value="Administrasi">Administrasi</option>';
    select.innerHTML += '<option value="Infrastruktur">Infrastruktur</option>';
    select.innerHTML += '<option value="Vacant">Vacant</option>';
  }

  select.value = currentValue;
}

/* =========================
   AUTO STATUS PEMINJAMAN
========================= */

function getTodayDateOnly() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function parseDateOnly(dateValue) {
  if (!dateValue) return null;

  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);

  return date;
}

function autoUpdatePeminjamanStatus() {
  const today = getTodayDateOnly();
  let changed = false;

  peminjamanData = peminjamanData.map(function (item) {
    const deadline = parseDateOnly(item.deadlineKembali);

    if (
      deadline &&
      deadline < today &&
      item.status !== 'DIKEMBALIKAN'
    ) {
      changed = true;
      return {
        ...item,
        status: 'TERLAMBAT'
      };
    }

    return item;
  });

  if (changed) {
    localStorage.setItem('SIARDI_PEMINJAMAN', JSON.stringify(peminjamanData));
  }
}

async function returnPeminjaman(id) {
  const item = peminjamanData.find(data => data.id === id);
  if (!item) return;

  showSaveLoader('Mengembalikan Arsip', 'Status peminjaman sedang diperbarui...');

  try {
    const index = peminjamanData.findIndex(data => data.id === id);

    if (index !== -1) {
      peminjamanData[index] = {
        ...peminjamanData[index],
        status: 'DIKEMBALIKAN',
        tanggalKembali: new Date().toISOString().slice(0, 10)
      };
    }

    localStorage.setItem('SIARDI_PEMINJAMAN', JSON.stringify(peminjamanData));

    await sendToSpreadsheet('SAVE_PEMINJAMAN', peminjamanData[index]);

    renderPeminjamanTable();

    hideSaveLoader();
    showToast('Arsip berhasil dikembalikan.', 'success');

  } catch (error) {
    hideSaveLoader();
    console.error(error);
    showToast('Status pengembalian gagal diperbarui.', 'error');
  }
}

/* =========================
   GLOBAL TABLE PAGINATION
========================= */
let currentArchiveRows = [];

const tablePagination = {
  arsip: { page: 1, perPage: 6 },
  user: { page: 1, perPage: 8 },
  unit: { page: 1, perPage: 8 },
  kategori: { page: 1, perPage: 8 },
  retensi: { page: 1, perPage: 8 },
  peminjaman: { page: 1, perPage: 8 }
};

function getPagedRows(key, data) {
  const state = tablePagination[key];
  if (!state) return data;

  const totalPages = Math.max(1, Math.ceil(data.length / state.perPage));

  if (state.page > totalPages) {
    state.page = totalPages;
  }

  const start = (state.page - 1) * state.perPage;
  const end = start + state.perPage;

  return data.slice(start, end);
}

function renderPagination(key, totalRows) {
  const box = document.getElementById(`${key}Pagination`);
  const state = tablePagination[key];

  if (!box || !state) return;

  const totalPages = Math.max(1, Math.ceil(totalRows / state.perPage));

  if (totalRows <= state.perPage) {
    box.innerHTML = '';
    return;
  }

  let buttons = `
    <span class="pagination-info">
      ${totalRows} data • Halaman ${state.page} dari ${totalPages}
    </span>

    <button onclick="changeTablePage('${key}', ${state.page - 1})" ${state.page === 1 ? 'disabled' : ''}>
      ‹
    </button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    buttons += `
      <button class="${i === state.page ? 'active' : ''}" onclick="changeTablePage('${key}', ${i})">
        ${i}
      </button>
    `;
  }

  buttons += `
    <button onclick="changeTablePage('${key}', ${state.page + 1})" ${state.page === totalPages ? 'disabled' : ''}>
      ›
    </button>
  `;

  box.innerHTML = buttons;
}

function changeTablePage(key, page) {
  const state = tablePagination[key];
  if (!state) return;

  state.page = page;
  rerenderTableByKey(key);
}

function resetTablePage(key) {
  if (tablePagination[key]) {
    tablePagination[key].page = 1;
  }
}

function rerenderTableByKey(key) {
  if (key === 'arsip') {
    renderTable(currentArchiveRows.length ? currentArchiveRows : arsipData);
  }

  if (key === 'user') renderUserTable();
  if (key === 'unit') renderUnitTable();
  if (key === 'kategori') renderKategoriTable();
  if (key === 'retensi') renderRetensiTable();
  if (key === 'peminjaman') renderPeminjamanTable();
}

/* =========================
   ROLE ACCESS MENU
========================= */

let currentUser = JSON.parse(localStorage.getItem('SIARDI_CURRENT_USER')) || null;

const roleAccessMap = {
  'Super Admin': [
    'home',
    'dashboard',
    'arsip',
    'input',
    'user',
    'role',
    'unit',
    'kategori-master',
    'retensi',
    'peminjaman',
    'laporan',
    'pengaturan'
  ],

  'Admin': [
    'home',
    'dashboard',
    'arsip',
    'input',
    'user',
    'unit',
    'kategori-master',
    'retensi',
    'peminjaman',
    'laporan'
  ],

  'Operator Arsip': [
    'home',
    'dashboard',
    'arsip',
    'input',
    'peminjaman'
  ],

  'Viewer': [
    'home',
    'dashboard',
    'arsip',
    'laporan'
  ]
};

function getLoginProfile(username, password) {
  const account = roleAccountData.find(function (item) {
    return (
      item.username === username &&
      item.password === password &&
      item.status === 'Aktif'
    );
  });

  if (!account) return null;

  return {
    id: account.id,
    nama: account.nama,
    username: account.username,
    role: account.role
  };
}

function canAccessPage(page) {
  if (!currentUser) return true;

  const allowedPages = roleAccessMap[currentUser.role] || [];

  return allowedPages.includes(page);
}

function getPageFromButton(button) {
  const onclickValue = button.getAttribute('onclick') || '';
  const match = onclickValue.match(/showPage\('([^']+)'/);

  return match ? match[1] : '';
}

function applyRoleAccess() {
  if (!currentUser) return;

  // Ambil semua tombol yang menjalankan showPage, baik sidebar, home, quick menu
  const menuButtons = document.querySelectorAll(
  '.menu-single, .menu-sub button, .quick-menu button, .home-menu-grid button, .home-hero-actions button, .archive-hero-actions button, .archive-stat-card button, .archive-panel-head button, .core-service-grid button, .coretax-service-card'
);

  menuButtons.forEach(function (button) {
    const page = getPageFromButton(button);

    if (!page) return;

    if (canAccessPage(page)) {
      button.hidden = false;
      button.style.removeProperty('display');
      button.style.removeProperty('pointer-events');
      button.style.removeProperty('opacity');
      button.classList.remove('role-hidden');
    } else {
      button.hidden = true;
      button.style.setProperty('display', 'none', 'important');
      button.style.setProperty('pointer-events', 'none', 'important');
      button.style.setProperty('opacity', '0', 'important');
      button.classList.remove('active');
      button.classList.add('role-hidden');
    }
  });

  // Sembunyikan group menu kalau semua sub menu di dalamnya hidden
  document.querySelectorAll('.menu-group').forEach(function (group) {
    const subButtons = Array.from(group.querySelectorAll('.menu-sub button'));

    if (!subButtons.length) return;

    const hasVisibleButton = subButtons.some(function (button) {
      return button.hidden === false && button.style.display !== 'none';
    });

    if (hasVisibleButton) {
      group.hidden = false;
      group.style.removeProperty('display');
    } else {
      group.hidden = true;
      group.style.setProperty('display', 'none', 'important');
      group.classList.remove('open');
    }
  });

  updateUserBox();
}

function updateUserBox() {
  const userBox = document.querySelector('.user-box');

  if (!userBox || !currentUser) return;

  const nameEl = userBox.querySelector('strong');
  const roleEl = userBox.querySelector('span');

  if (nameEl) nameEl.textContent = currentUser.nama || 'Pengguna Sistem';
  if (roleEl) roleEl.textContent = currentUser.role || 'User';

  const navbarUserName = document.getElementById('navbarUserName');
  const navbarUserCode = document.getElementById('navbarUserCode');

  if (navbarUserName && currentUser) {
    navbarUserName.textContent = currentUser.nama || 'Pengguna';
  }

  if (navbarUserCode && currentUser) {
    navbarUserCode.textContent = currentUser.role || 'COREARSIP';
  }
}

function updateHomeWelcome() {
  const homeWelcomeTitle = document.getElementById('homeWelcomeTitle');

  if (!homeWelcomeTitle) return;

  if (currentUser && currentUser.nama) {
    homeWelcomeTitle.textContent = `Selamat datang, ${currentUser.nama}`;
  } else if (currentUser && currentUser.role) {
    homeWelcomeTitle.textContent = `Selamat datang, ${currentUser.role}`;
  } else {
    homeWelcomeTitle.textContent = 'Selamat datang di Sistem Arsip Digital';
  }
}

const roleFocusConfig = {
  'Super Admin': {
    access: [
      'Akses seluruh menu sistem',
      'Kelola user dan role',
      'Kontrol master data',
      'Akses laporan dan pengaturan'
    ],
    limit: [
      'Tidak boleh hapus akun sendiri',
      'Minimal satu Super Admin aktif',
      'Perubahan role wajib terkontrol'
    ],
    work: [
      'Audit akun pengguna',
      'Validasi role akses',
      'Pantau konfigurasi sistem'
    ]
  },

  'Admin': {
    access: [
      'Kelola data arsip',
      'Input dan update arsip',
      'Kelola master data',
      'Akses laporan operasional'
    ],
    limit: [
      'Tidak akses pengaturan sistem penuh',
      'Tidak menghapus Super Admin',
      'Akses mengikuti role yang diberikan'
    ],
    work: [
      'Validasi data arsip',
      'Kontrol kelengkapan metadata',
      'Pantau peminjaman arsip'
    ]
  },

  'Operator Arsip': {
    access: [
      'Input arsip baru',
      'Lihat data arsip',
      'Update data operasional',
      'Monitor peminjaman'
    ],
    limit: [
      'Tidak akses manajemen user',
      'Tidak akses manajemen role',
      'Tidak akses pengaturan sistem'
    ],
    work: [
      'Input data arsip lengkap',
      'Pastikan file dan metadata sesuai',
      'Update status peminjaman'
    ]
  },

  'Viewer': {
    access: [
      'Lihat data arsip',
      'Cari dokumen arsip',
      'Akses dashboard',
      'Buka laporan'
    ],
    limit: [
      'Tidak bisa input data',
      'Tidak bisa edit atau hapus',
      'Tidak akses master data'
    ],
    work: [
      'Monitoring arsip',
      'Cari data sesuai kebutuhan',
      'Gunakan laporan sebagai referensi'
    ]
  }
};

function renderRoleFocusPanel() {
  const roleEl = document.getElementById('roleFocusRole');
  const userEl = document.getElementById('roleFocusUser');
  const accessEl = document.getElementById('roleFocusAccess');
  const limitEl = document.getElementById('roleFocusLimit');
  const workEl = document.getElementById('roleFocusWork');

  if (!roleEl || !userEl || !accessEl || !limitEl || !workEl) return;

  const role = currentUser && currentUser.role ? currentUser.role : 'Viewer';
  const nama = currentUser && currentUser.nama ? currentUser.nama : 'Pengguna Sistem';
  const config = roleFocusConfig[role] || roleFocusConfig['Viewer'];

  roleEl.textContent = role;
  userEl.textContent = nama;

  accessEl.innerHTML = config.access.map(function (item) {
    return `<li>${item}</li>`;
  }).join('');

  limitEl.innerHTML = config.limit.map(function (item) {
    return `<li>${item}</li>`;
  }).join('');

  workEl.innerHTML = config.work.map(function (item) {
    return `<li>${item}</li>`;
  }).join('');
}

function saveRoleStorage() {
  localStorage.setItem('SIARDI_ROLE_ACCOUNTS', JSON.stringify(roleAccountData));
}

function openRoleForm() {
  const form = document.getElementById('roleFormBox');
  if (form) form.classList.add('active');
}

function clearRoleForm() {
  editingRoleId = null;

  document.getElementById('roleNama').value = '';
  document.getElementById('roleUsername').value = '';
  document.getElementById('rolePassword').value = '';
  document.getElementById('roleAkses').value = 'Admin';
  document.getElementById('roleStatus').value = 'Aktif';
  document.getElementById('roleKeterangan').value = '';

  const btn = document.getElementById('btnSaveRole');
  if (btn) btn.textContent = 'Simpan Akun';
}

function saveRoleAccount() {
  const nama = document.getElementById('roleNama').value.trim();
  const username = document.getElementById('roleUsername').value.trim();
  const password = document.getElementById('rolePassword').value.trim();
  const role = document.getElementById('roleAkses').value;
  const status = document.getElementById('roleStatus').value;
  const keterangan = document.getElementById('roleKeterangan').value.trim();

  if (!nama || !username || !password) {
    showToast('Nama, username, dan password wajib diisi.', 'warning');
    return;
  }

  const duplicate = roleAccountData.find(function (item) {
    return item.username === username && item.id !== editingRoleId;
  });

  if (duplicate) {
    showToast('Username sudah digunakan akun lain.', 'warning');
    return;
  }

  showSaveLoader('Menyimpan Akun Role', 'Data akun sedang diproses...');

  setTimeout(function () {
    if (editingRoleId) {
      const index = roleAccountData.findIndex(item => item.id === editingRoleId);

      if (index !== -1) {
        roleAccountData[index] = {
          ...roleAccountData[index],
          nama,
          username,
          password,
          role,
          status,
          keterangan
        };

        if (currentUser && currentUser.id === editingRoleId) {
          currentUser = {
            id: editingRoleId,
            nama,
            username,
            role
          };

          localStorage.setItem('SIARDI_CURRENT_USER', JSON.stringify(currentUser));
          updateUserBox();
          applyRoleAccess();
        }
      }
    } else {
      roleAccountData.push({
        id: 'ROLE-' + String(Date.now()).slice(-6),
        nama,
        username,
        password,
        role,
        status,
        keterangan
      });
    }

    saveRoleStorage();
    clearRoleForm();
    renderRoleTable();

    hideSaveLoader();
    showToast(editingRoleId ? 'Akun role berhasil diperbarui.' : 'Akun role berhasil disimpan.', 'success');
  }, 500);
}

function renderRoleTable() {
  const tbody = document.getElementById('roleTable');
  if (!tbody) return;

  if (!roleAccountData.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">Belum ada akun role.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = roleAccountData.map(function (item) {
    return `
      <tr>
        <td><b>${item.nama}</b></td>
        <td>${item.username}</td>
        <td>${item.password}</td>
        <td><span class="role-badge">${item.role}</span></td>
        <td>
          <span class="status-badge ${String(item.status).toLowerCase()}">
            ${item.status}
          </span>
        </td>
        <td>${item.keterangan || '-'}</td>
        <td>
          <div class="action-group">
            <button class="btn-edit" onclick="editRoleAccount('${item.id}')">✎</button>
            <button class="btn-delete" onclick="deleteRoleAccount('${item.id}')">🗑</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function editRoleAccount(id) {
  const item = roleAccountData.find(account => account.id === id);
  if (!item) return;

  editingRoleId = id;

  document.getElementById('roleNama').value = item.nama || '';
  document.getElementById('roleUsername').value = item.username || '';
  document.getElementById('rolePassword').value = item.password || '';
  document.getElementById('roleAkses').value = item.role || 'Admin';
  document.getElementById('roleStatus').value = item.status || 'Aktif';
  document.getElementById('roleKeterangan').value = item.keterangan || '';

  const btn = document.getElementById('btnSaveRole');
  if (btn) btn.textContent = 'Update Akun';

  openRoleForm();
}

function deleteRoleAccount(id) {
  const item = roleAccountData.find(account => account.id === id);
  if (!item) return;

  if (currentUser && currentUser.id === id) {
    showToast('Akun yang sedang login tidak boleh dihapus.', 'warning');
    return;
  }

  const remainingSuperAdmin = roleAccountData.filter(function (account) {
    return account.role === 'Super Admin' && account.id !== id;
  });

  if (item.role === 'Super Admin' && remainingSuperAdmin.length < 1) {
    showToast('Minimal harus ada satu akun Super Admin aktif.', 'warning');
    return;
  }

  showDeleteModal(
    'Hapus Akun Role?',
    'Akun login ini akan dihapus dari sistem.',
    function () {
      showSaveLoader('Menghapus Akun Role', 'Data akun sedang dihapus...');

      setTimeout(function () {
        roleAccountData = roleAccountData.filter(account => account.id !== id);

        saveRoleStorage();
        renderRoleTable();

        hideSaveLoader();
        showToast('Akun role berhasil dihapus.', 'success');
      }, 500);
    }
  );
}

function renderCorePortalInfo() {
  const notifMetadata = document.getElementById('notifMetadata');
  const notifPeminjaman = document.getElementById('notifPeminjaman');
  const notifInaktif = document.getElementById('notifInaktif');

  const metadataKosong = arsipData.filter(function (item) {
    return (
      !item.nomor ||
      !item.judul ||
      !item.kategori ||
      !item.unit ||
      !item.tahun ||
      !item.status
    );
  }).length;

  const peminjamanAktif = peminjamanData.filter(function (item) {
    return item.status !== 'DIKEMBALIKAN';
  }).length;

  const arsipInaktif = arsipData.filter(function (item) {
    return item.status === 'INAKTIF';
  }).length;

  if (notifMetadata) {
    notifMetadata.textContent = `${metadataKosong} data perlu validasi metadata`;
  }

  if (notifPeminjaman) {
    notifPeminjaman.textContent = `${peminjamanAktif} peminjaman aktif`;
  }

  if (notifInaktif) {
    notifInaktif.textContent = `${arsipInaktif} arsip inaktif`;
  }
}

function searchArchiveFromHome() {
  const homeSearchInput = document.getElementById('homeSearchInput');
  const searchInput = document.getElementById('searchInput');

  const keyword = homeSearchInput ? homeSearchInput.value.trim() : '';

  if (searchInput) {
    searchInput.value = keyword;
  }

  const arsipButton = document.querySelector(`.menu-sub button[onclick*="'arsip'"]`);

  showPage('arsip', arsipButton);

  setTimeout(function () {
    filterArchive(true);
  }, 50);
}




/* =========================================================
   SYSTEM SETTINGS - COREARSIP
========================================================= */

const defaultSystemSettings = {
  appName: 'COREARSIP',
  instansi: '',
  footer: '© 2026 D4 Kearsipan & Sains Informasi. All rights reserved.',
  defaultPage: 'home',
  cardMode: 'normal',
  arsipPerPage: 6,
  masterPerPage: 8
};

let systemSettings = JSON.parse(localStorage.getItem('COREARSIP_SETTINGS')) || defaultSystemSettings;

function saveSystemSettings() {
  systemSettings = {
    appName: document.getElementById('settingAppName')?.value.trim() || 'COREARSIP',
    instansi: document.getElementById('settingInstansi')?.value.trim() || '',
    footer: document.getElementById('settingFooter')?.value.trim() || defaultSystemSettings.footer,
    defaultPage: document.getElementById('settingDefaultPage')?.value || 'home',
    cardMode: document.getElementById('settingCardMode')?.value || 'normal',
    arsipPerPage: Number(document.getElementById('settingArsipPerPage')?.value || 6),
    masterPerPage: Number(document.getElementById('settingMasterPerPage')?.value || 8)
  };

  localStorage.setItem('COREARSIP_SETTINGS', JSON.stringify(systemSettings));

  applySystemSettings();
  showToast('Pengaturan sistem berhasil disimpan.', 'success');
}

function loadSystemSettings() {
  systemSettings = JSON.parse(localStorage.getItem('COREARSIP_SETTINGS')) || defaultSystemSettings;

  const appName = document.getElementById('settingAppName');
  const instansi = document.getElementById('settingInstansi');
  const footer = document.getElementById('settingFooter');
  const defaultPage = document.getElementById('settingDefaultPage');
  const cardMode = document.getElementById('settingCardMode');
  const arsipPerPage = document.getElementById('settingArsipPerPage');
  const masterPerPage = document.getElementById('settingMasterPerPage');

  if (appName) appName.value = systemSettings.appName || 'COREARSIP';
  if (instansi) instansi.value = systemSettings.instansi || '';
  if (footer) footer.value = systemSettings.footer || defaultSystemSettings.footer;
  if (defaultPage) defaultPage.value = systemSettings.defaultPage || 'home';
  if (cardMode) cardMode.value = systemSettings.cardMode || 'normal';
  if (arsipPerPage) arsipPerPage.value = String(systemSettings.arsipPerPage || 6);
  if (masterPerPage) masterPerPage.value = String(systemSettings.masterPerPage || 8);

  applySystemSettings();
}

function applySystemSettings() {
  document.body.classList.remove('card-mode-normal', 'card-mode-glass', 'card-mode-solid');
  document.body.classList.add('card-mode-' + (systemSettings.cardMode || 'normal'));

  const footer = document.querySelector('.app-footer');
  if (footer) {
    footer.textContent = systemSettings.footer || defaultSystemSettings.footer;
  }

  const brandTitle = document.querySelector('.brand h2');
  if (brandTitle) {
    brandTitle.textContent = systemSettings.appName || 'COREARSIP';
  }

  tablePagination.arsip.perPage = Number(systemSettings.arsipPerPage || 6);
  tablePagination.user.perPage = Number(systemSettings.masterPerPage || 8);
  tablePagination.unit.perPage = Number(systemSettings.masterPerPage || 8);
  tablePagination.kategori.perPage = Number(systemSettings.masterPerPage || 8);
  tablePagination.retensi.perPage = Number(systemSettings.masterPerPage || 8);
  tablePagination.peminjaman.perPage = Number(systemSettings.masterPerPage || 8);
}

function backupLocalData() {
  const backup = {
    settings: systemSettings,
    arsipData,
    userData,
    unitData,
    kategoriData,
    retensiData,
    peminjamanData,
    roleAccountData,
    backupAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'backup-corearsip-' + new Date().toISOString().slice(0, 10) + '.json';
  link.click();

  URL.revokeObjectURL(url);

  showToast('Backup data lokal berhasil dibuat.', 'success');
}

function resetLocalCache() {
  const confirmReset = confirm('Reset cache lokal akan menghapus data lokal browser. Data Spreadsheet tidak otomatis terhapus. Lanjutkan?');

  if (!confirmReset) return;

  localStorage.removeItem('SIARDI_DATA');
  localStorage.removeItem('SIARDI_USERS');
  localStorage.removeItem('SIARDI_UNITS');
  localStorage.removeItem('SIARDI_KATEGORI');
  localStorage.removeItem('SIARDI_RETENSI');
  localStorage.removeItem('SIARDI_PEMINJAMAN');

  showToast('Cache lokal berhasil direset. Halaman akan dimuat ulang.', 'warning');

  setTimeout(function () {
    location.reload();
  }, 900);
}

/* =========================================================
   HOME HERO SLIDER
========================================================= */

let homeSlideIndex = 0;
let homeSlideTimer = null;

function renderHomeSlide() {
  const slides = document.querySelectorAll('.archive-hero-slider .home-slide');
  const dots = document.querySelectorAll('.archive-hero-slider .home-slide-dots button');

  if (!slides.length) return;

  slides.forEach(function (slide, index) {
    slide.classList.toggle('active', index === homeSlideIndex);
  });

  dots.forEach(function (dot, index) {
    dot.classList.toggle('active', index === homeSlideIndex);
  });
}

function setHomeSlide(index) {
  const slides = document.querySelectorAll('.archive-hero-slider .home-slide');

  if (!slides.length) return;

  homeSlideIndex = index;

  if (homeSlideIndex < 0) homeSlideIndex = slides.length - 1;
  if (homeSlideIndex >= slides.length) homeSlideIndex = 0;

  renderHomeSlide();
  restartHomeSlideTimer();
}

function changeHomeSlide(direction) {
  setHomeSlide(homeSlideIndex + direction);
}

function startHomeSlideTimer() {
  clearInterval(homeSlideTimer);

  homeSlideTimer = setInterval(function () {
    const slides = document.querySelectorAll('.archive-hero-slider .home-slide');

    if (!slides.length) return;

    homeSlideIndex = (homeSlideIndex + 1) % slides.length;
    renderHomeSlide();
  }, 4500);
}

function restartHomeSlideTimer() {
  clearInterval(homeSlideTimer);
  startHomeSlideTimer();
}

document.addEventListener('DOMContentLoaded', function () {
  renderHomeSlide();
  startHomeSlideTimer();
});

/* =========================================================
   EXPORT DATA ARSIP - EXCEL & PDF
========================================================= */

function getArchiveExportRows() {
  const kategori = document.getElementById('filterKategori')?.value || '';
  const unit = document.getElementById('filterUnit')?.value || '';
  const tahun = document.getElementById('filterTahun')?.value || '';
  const status = document.getElementById('filterStatus')?.value || '';
  const keyword = document.getElementById('searchInput')?.value.toLowerCase() || '';

  return arsipData.filter(function (item) {
    const matchKategori = !kategori || item.kategori === kategori;
    const matchUnit = !unit || item.unit === unit;
    const matchTahun = !tahun || String(item.tahun) === String(tahun);
    const matchStatus = !status || item.status === status;

    const matchKeyword =
      !keyword ||
      String(item.id || '').toLowerCase().includes(keyword) ||
      String(item.nomor || '').toLowerCase().includes(keyword) ||
      String(item.judul || '').toLowerCase().includes(keyword) ||
      String(item.kategori || '').toLowerCase().includes(keyword) ||
      String(item.unit || '').toLowerCase().includes(keyword) ||
      String(item.tahun || '').toLowerCase().includes(keyword) ||
      String(item.status || '').toLowerCase().includes(keyword);

    return matchKategori && matchUnit && matchTahun && matchStatus && matchKeyword;
  });
}

function formatArchiveExportRows(rows) {
  return rows.map(function (item, index) {
    return {
      No: index + 1,
      'ID Arsip': item.id || '',
      'Nomor Arsip': item.nomor || '',
      'Judul Arsip': item.judul || '',
      'Kategori': item.kategori || '',
      'Unit Kerja': item.unit || '',
      'Tahun': item.tahun || '',
      'Status Retensi': item.status || '',
      'File': item.file || '-'
    };
  });
}

function getExportFileName(extension) {
  const today = new Date().toISOString().slice(0, 10);
  return `data-arsip-corearsip-${today}.${extension}`;
}

function exportArchiveExcel() {
  const rows = getArchiveExportRows();

  if (!rows.length) {
    showToast('Tidak ada data arsip yang dapat diexport.', 'warning');
    return;
  }

  if (typeof XLSX === 'undefined') {
    showToast('Library Excel belum termuat. Periksa koneksi internet/CDN.', 'error');
    return;
  }

  const exportRows = formatArchiveExportRows(rows);
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 16 },
    { wch: 22 },
    { wch: 42 },
    { wch: 22 },
    { wch: 22 },
    { wch: 10 },
    { wch: 18 },
    { wch: 28 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Arsip');
  XLSX.writeFile(workbook, getExportFileName('xlsx'));

  showToast('Data arsip berhasil diexport ke Excel.', 'success');
}

function exportArchivePDF() {
  const rows = getArchiveExportRows();

  if (!rows.length) {
    showToast('Tidak ada data arsip yang dapat diexport.', 'warning');
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showToast('Library PDF belum termuat. Periksa koneksi internet/CDN.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape', 'mm', 'a4');

  const title = 'Laporan Data Arsip COREARSIP';
  const dateText = 'Tanggal Export: ' + new Date().toLocaleDateString('id-ID');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(title, 14, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(dateText, 14, 21);
  doc.text('Total Data: ' + rows.length + ' arsip', 14, 26);

  const tableBody = rows.map(function (item, index) {
    return [
      index + 1,
      item.id || '',
      item.nomor || '',
      item.judul || '',
      item.kategori || '',
      item.unit || '',
      item.tahun || '',
      item.status || '',
      item.file || '-'
    ];
  });

  doc.autoTable({
    startY: 32,
    head: [[
      'No',
      'ID Arsip',
      'Nomor',
      'Judul',
      'Kategori',
      'Unit',
      'Tahun',
      'Status',
      'File'
    ]],
    body: tableBody,
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: 'linebreak'
    },
    headStyles: {
      fillColor: [23, 36, 90],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 253]
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 24 },
      2: { cellWidth: 32 },
      3: { cellWidth: 58 },
      4: { cellWidth: 34 },
      5: { cellWidth: 34 },
      6: { cellWidth: 16 },
      7: { cellWidth: 26 },
      8: { cellWidth: 42 }
    },
    margin: { left: 14, right: 14 }
  });

  doc.save(getExportFileName('pdf'));

  showToast('Data arsip berhasil diexport ke PDF.', 'success');
}

/* =========================================================
   SESSION LOGIN - STAY LOGIN ON REFRESH + AUTO LOGOUT 10 MENIT
========================================================= */

const CORE_SESSION_ACTIVITY_KEY = 'COREARSIP_LAST_ACTIVITY';
const CORE_LAST_PAGE_KEY = 'COREARSIP_LAST_PAGE';
const CORE_SESSION_TIMEOUT = 10 * 60 * 1000; // 10 menit

let coreIdleTimer = null;

function getMenuButtonByPage(page) {
  return document.querySelector(
    `.menu-single[onclick*="'${page}'"], .menu-sub button[onclick*="'${page}'"]`
  );
}

function getSavedCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('SIARDI_CURRENT_USER')) || null;
  } catch (error) {
    return null;
  }
}

function updateSessionActivity() {
  if (!currentUser) return;

  localStorage.setItem(CORE_SESSION_ACTIVITY_KEY, String(Date.now()));
}

function isSessionStillValid() {
  const savedUser = getSavedCurrentUser();
  const lastActivity = Number(localStorage.getItem(CORE_SESSION_ACTIVITY_KEY) || 0);

  if (!savedUser || !lastActivity) return false;

  return Date.now() - lastActivity <= CORE_SESSION_TIMEOUT;
}

function clearCoreSession() {
  currentUser = null;

  localStorage.removeItem('SIARDI_CURRENT_USER');
  localStorage.removeItem(CORE_SESSION_ACTIVITY_KEY);
  localStorage.removeItem(CORE_LAST_PAGE_KEY);

  clearTimeout(coreIdleTimer);
}

function showLoginPageOnly() {
  document.body.classList.remove(
    'is-booting',
    'is-app',
    'is-loading',
    'is-logout-loading',
    'is-save-loading'
  );

  document.body.classList.add('is-login');
}

function showAppPageOnly() {
  document.body.classList.remove(
    'is-booting',
    'is-login',
    'is-loading',
    'is-logout-loading'
  );

  document.body.classList.add('is-app');
}

function startIdleTimer() {
  clearTimeout(coreIdleTimer);

  if (!currentUser) return;

  const lastActivity = Number(localStorage.getItem(CORE_SESSION_ACTIVITY_KEY) || Date.now());
  const remainingTime = CORE_SESSION_TIMEOUT - (Date.now() - lastActivity);

  coreIdleTimer = setTimeout(function () {
    autoLogoutByIdle();
  }, Math.max(1000, remainingTime));
}

function autoLogoutByIdle() {
  if (!currentUser) return;

  clearCoreSession();
  showLoginPageOnly();

  showToast('Sesi berakhir karena tidak ada aktivitas selama 10 menit.', 'warning');
}

function registerSessionActivityEvents() {
  const events = ['click', 'mousemove', 'keydown', 'scroll', 'touchstart'];

  events.forEach(function (eventName) {
    document.addEventListener(eventName, function () {
      if (!currentUser) return;
      if (!document.body.classList.contains('is-app')) return;

      updateSessionActivity();
      startIdleTimer();
    });
  });
}

function restoreSessionAfterRefresh() {
  if (!isSessionStillValid()) {
    clearCoreSession();
    showLoginPageOnly();
    return;
  }

  currentUser = getSavedCurrentUser();

  showAppPageOnly();

  applyRoleAccess();
  updateHomeWelcome();

  if (typeof renderRoleFocusPanel === 'function') {
    renderRoleFocusPanel();
  }

  const savedPage = localStorage.getItem(CORE_LAST_PAGE_KEY);
  const defaultPage = systemSettings?.defaultPage || 'home';
  const targetPage = savedPage || defaultPage || 'home';

  const finalPage = canAccessPage(targetPage) ? targetPage : 'home';
  const activeBtn = getMenuButtonByPage(finalPage);

  showPage(finalPage, activeBtn);

  updateSessionActivity();
  startIdleTimer();
}

function toggleLoginPassword() {
  const passwordInput = document.getElementById('password');
  const toggleButton = document.querySelector('.password-toggle');

  if (!passwordInput || !toggleButton) return;

  const eyeIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"></path>
      <circle cx="12" cy="12" r="3"></circle>
    </svg>
  `;

  const eyeOffIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a21.77 21.77 0 0 1 5.06-5.94"></path>
      <path d="M9.9 4.24A10.93 10.93 0 0 1 12 5c7 0 11 7 11 7a21.66 21.66 0 0 1-4.22 5.17"></path>
      <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"></path>
      <path d="M1 1l22 22"></path>
    </svg>
  `;

  const isPassword = passwordInput.type === 'password';

  passwordInput.type = isPassword ? 'text' : 'password';
  toggleButton.innerHTML = isPassword ? eyeOffIcon : eyeIcon;
  toggleButton.setAttribute(
    'aria-label',
    isPassword ? 'Sembunyikan password' : 'Lihat password'
  );
}

/* =========================================================
   CORETAX MEGA MENU BEHAVIOR
========================================================= */

let coretaxMegaTimer = null;

function closeAllMenuGroups() {
  document.querySelectorAll('.menu-group').forEach(function (group) {
    group.classList.remove('open');
  });

  document.body.classList.remove('navbar-mega-open');
}

function openCoretaxMega(group) {
  if (!group) return;

  clearTimeout(coretaxMegaTimer);

  document.querySelectorAll('.menu-group').forEach(function (item) {
    if (item !== group) {
      item.classList.remove('open');
    }
  });

  group.classList.add('open');
  document.body.classList.add('navbar-mega-open');
}

function scheduleCloseCoretaxMega() {
  clearTimeout(coretaxMegaTimer);

  coretaxMegaTimer = setTimeout(function () {
    closeAllMenuGroups();
  }, 250);
}

function toggleMenuGroup(parentButton) {
  const group = parentButton.closest('.menu-group');

  if (!group) return;

  const isOpen = group.classList.contains('open');

  if (isOpen) {
    closeAllMenuGroups();
  } else {
    openCoretaxMega(group);
  }
}

/* Hover menu parent */
document.querySelectorAll('.coretax-mega-nav .menu-group').forEach(function (group) {
  group.addEventListener('mouseenter', function () {
    openCoretaxMega(group);
  });
});

/* Mouse keluar dari seluruh navbar baru close */
document.querySelectorAll('.sidebar, .coretax-navbar').forEach(function (navbar) {
  navbar.addEventListener('mouseleave', function () {
    scheduleCloseCoretaxMega();
  });

  navbar.addEventListener('mouseenter', function () {
    clearTimeout(coretaxMegaTimer);
  });
});

/* Hover panel mega tetap terbuka */
document.querySelectorAll('.coretax-mega').forEach(function (mega) {
  mega.addEventListener('mouseenter', function () {
    clearTimeout(coretaxMegaTimer);
  });

  mega.addEventListener('mouseleave', function () {
    scheduleCloseCoretaxMega();
  });
});

/* Klik area luar tutup */
document.addEventListener('click', function (event) {
  if (!event.target.closest('.sidebar') && !event.target.closest('.coretax-navbar')) {
    closeAllMenuGroups();
  }
});

/* Klik item submenu tutup setelah pindah halaman */
document.querySelectorAll('.coretax-mega button').forEach(function (button) {
  button.addEventListener('click', function () {
    setTimeout(function () {
      closeAllMenuGroups();
    }, 150);
  });
});

/* Hover Home tutup mega */
document.querySelectorAll('.menu-single').forEach(function (button) {
  button.addEventListener('mouseenter', function () {
    closeAllMenuGroups();
  });
});

/* =========================================================
   CORETAX MEGA MENU V2 - SMOOTH & STABLE
========================================================= */

let coreMegaCloseTimer = null;

function closeAllMenuGroups() {
  document.querySelectorAll('.menu-group').forEach(function (group) {
    group.classList.remove('open');
  });

  document.body.classList.remove('navbar-mega-open');
}

function openMegaMenu(group) {
  if (!group) return;

  clearTimeout(coreMegaCloseTimer);

  document.querySelectorAll('.menu-group').forEach(function (item) {
    if (item !== group) {
      item.classList.remove('open');
    }
  });

  group.classList.add('open');
  document.body.classList.add('navbar-mega-open');
}

function delayCloseMegaMenu() {
  clearTimeout(coreMegaCloseTimer);

  coreMegaCloseTimer = setTimeout(function () {
    closeAllMenuGroups();
  }, 650);
}

function toggleMenuGroup(parentButton) {
  const group = parentButton.closest('.menu-group');

  if (!group) return;

  if (group.classList.contains('open')) {
    closeAllMenuGroups();
  } else {
    openMegaMenu(group);
  }
}

/* Hover parent menu */
document.querySelectorAll('.coretax-mega-nav .menu-group').forEach(function (group) {
  group.addEventListener('mouseenter', function () {
    openMegaMenu(group);
  });

  group.addEventListener('mouseleave', function () {
    delayCloseMegaMenu();
  });
});

/* Saat masuk panel mega, jangan tutup */
document.querySelectorAll('.coretax-mega').forEach(function (mega) {
  mega.addEventListener('mouseenter', function () {
    clearTimeout(coreMegaCloseTimer);
  });

  mega.addEventListener('mouseleave', function () {
    delayCloseMegaMenu();
  });
});

/* Klik luar navbar = tutup */
document.addEventListener('click', function (event) {
  const insideNavbar = event.target.closest('.sidebar');

  if (!insideNavbar) {
    closeAllMenuGroups();
  }
});

/* Klik submenu = pindah halaman lalu tutup halus */
document.querySelectorAll('.coretax-mega button').forEach(function (button) {
  button.addEventListener('click', function () {
    setTimeout(function () {
      closeAllMenuGroups();
    }, 220);
  });
});

/* Hover Home = tutup mega */
document.querySelectorAll('.menu-single').forEach(function (button) {
  button.addEventListener('mouseenter', function () {
    closeAllMenuGroups();
  });
});

/* =========================================================
   CORETAX EXACT DROPDOWN BEHAVIOR - COREARSIP
========================================================= */

let coretaxMenuTimer = null;

function closeAllMenuGroups() {
  document.querySelectorAll('.menu-group').forEach(function (group) {
    group.classList.remove('open');
  });

  document.body.classList.remove('navbar-mega-open');
}

function openCoretaxMenu(group) {
  if (!group) return;

  clearTimeout(coretaxMenuTimer);

  document.querySelectorAll('.menu-group').forEach(function (item) {
    if (item !== group) {
      item.classList.remove('open');
    }
  });

  group.classList.add('open');
  document.body.classList.add('navbar-mega-open');
}

function delayCloseCoretaxMenu() {
  clearTimeout(coretaxMenuTimer);

  coretaxMenuTimer = setTimeout(function () {
    closeAllMenuGroups();
  }, 500);
}

function toggleMenuGroup(parentButton) {
  const group = parentButton.closest('.menu-group');

  if (!group) return;

  if (group.classList.contains('open')) {
    closeAllMenuGroups();
  } else {
    openCoretaxMenu(group);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.coretax-mega-nav .menu-group').forEach(function (group) {
    group.addEventListener('mouseenter', function () {
      openCoretaxMenu(group);
    });

    group.addEventListener('mouseleave', function () {
      delayCloseCoretaxMenu();
    });
  });

  document.querySelectorAll('.coretax-mega-panel').forEach(function (panel) {
    panel.addEventListener('mouseenter', function () {
      clearTimeout(coretaxMenuTimer);
    });

    panel.addEventListener('mouseleave', function () {
      delayCloseCoretaxMenu();
    });
  });

  document.addEventListener('click', function (event) {
    const isInsideNavbar = event.target.closest('.coretax-navbar');

    if (!isInsideNavbar) {
      closeAllMenuGroups();
    }
  });

  document.querySelectorAll('.coretax-mega-panel button').forEach(function (button) {
    button.addEventListener('click', function () {
      setTimeout(function () {
        closeAllMenuGroups();
      }, 150);
    });
  });

  document.querySelectorAll('.menu-single').forEach(function (button) {
    button.addEventListener('mouseenter', function () {
      closeAllMenuGroups();
    });
  });
});

