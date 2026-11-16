'use strict';

(function () {
  const deleteModalElement = document.getElementById('pf-list-delete-modal');
  const deleteText = document.getElementById('pf-list-delete-text');
  const deleteError = document.getElementById('pf-list-delete-error');
  const deleteConfirm = document.getElementById('pf-list-delete-confirm');

  let deletingRow = null;

  const getApi = () => {
    if (!window.AA) throw new Error("L'API GESCO n'est pas disponible.");
    return window.AA;
  };

  const modalFor = (element) => {
    if (!element || !window.bootstrap?.Modal) return null;
    return window.bootstrap.Modal.getOrCreateInstance(element);
  };

  const showError = (element, message) => {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('d-none');
  };

  const clearError = (element) => {
    if (!element) return;
    element.textContent = '';
    element.classList.add('d-none');
  };

  const setDeleteSaving = (value) => {
    if (!deleteConfirm) return;
    deleteConfirm.disabled = value;
    deleteConfirm.textContent = value ? 'Suppression…' : 'Supprimer';
  };

  const openEdit = (row) => {
    if (!row?.id) return;
    window.location.href = `gesco-facturation-proforma.html?id=${encodeURIComponent(row.id)}`;
  };

  const openDelete = (row) => {
    if (!row?.id) return;
    deletingRow = row;
    clearError(deleteError);
    if (deleteText) {
      deleteText.textContent = `La proforma ${row.reference || row.id} sera supprimée définitivement.`;
    }
    const modal = modalFor(deleteModalElement);
    if (!modal) {
      window.alert('La fenêtre de suppression est indisponible.');
      return;
    }
    modal.show();
  };

  const confirmDelete = async () => {
    if (!deletingRow?.id) return;
    clearError(deleteError);
    setDeleteSaving(true);
    try {
      await getApi().deleteFacture(deletingRow.id);
      modalFor(deleteModalElement)?.hide();
      window.location.reload();
    } catch (error) {
      showError(deleteError, error.message || 'Impossible de supprimer la proforma.');
    } finally {
      setDeleteSaving(false);
    }
  };

  window.GescoProformaActions = { edit: openEdit, remove: openDelete };

  deleteConfirm?.addEventListener('click', confirmDelete);
  deleteModalElement?.addEventListener('hidden.bs.modal', () => {
    deletingRow = null;
    clearError(deleteError);
    setDeleteSaving(false);
  });
})();
