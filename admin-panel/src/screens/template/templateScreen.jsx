import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../../config';
import { TrashIcon, PlusIcon } from '@heroicons/react/24/outline';

function TemplateScreen() {
  const [addTemplateModal, showAddTemplateModal] = useState(false);
  const [deleteConfirmModal, showDeleteConfirmModal] = useState(false);
  const [selectedUploadType, setSelectedUploadType] = useState('none');
  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);

  const getFileUrl = (fileUrl) => {
    if (!fileUrl) return '';
    if (fileUrl.startsWith('http')) return fileUrl;

    const apiOrigin = API_URL.replace(/\/api\/?$/, '');
    return `${apiOrigin}${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;
  };

  // Fetch templates
  const fetchTemplates = async () => {
    try {
      const response = await axios.get(`${API_URL}/get_templates`);
      setTemplates(response.data.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Create template
  const handleSubmit = async () => {
    try {
      const formData = new FormData();
      formData.append('name', templateName);
      formData.append('description', templateBody);
      formData.append('fileType', selectedUploadType);
      if (selectedUploadType !== 'none' && selectedFile) {
        formData.append('file', selectedFile);
      }

      const response = await axios.post(`${API_URL}/create_template`, formData);
      if (response.data.success) {
        alert('Template created successfully!');
        fetchTemplates();
        resetForm();
      } else {
        alert('Error creating template');
      }
    } catch (err) {
      console.error('Error creating template:', err);
      alert('Something went wrong');
    }
  };

  // Delete template
  const confirmDelete = async () => {
    try {
      await axios.delete(`${API_URL}/delete_template/${selectedTemplateId}`);
      alert('Template deleted successfully!');
      fetchTemplates();
      showDeleteConfirmModal(false);
      setSelectedTemplateId(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error deleting template');
    }
  };

  const resetForm = () => {
    setTemplateName('');
    setTemplateBody('');
    setSelectedUploadType('none');
    setSelectedFile(null);
    showAddTemplateModal(false);
  };

  return (
    <div className="p-4">
      <div className='text-right mb-4'>
        <button
          className='bg-blue-600 text-white p-2 rounded border flex items-center gap-1'
          onClick={() => showAddTemplateModal(true)}
        >
          <PlusIcon className='h-5 w-5' /> New Template
        </button>
      </div>

      <table className="table-auto w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2">Template Name</th>
            <th className="border border-gray-300 px-4 py-2">Template</th>
            <th className="border border-gray-300 px-4 py-2">Template Body</th>
            <th className="border border-gray-300 px-4 py-2">File Type</th>
            <th className="border border-gray-300 px-4 py-2">Added Time</th>
            <th className="border border-gray-300 px-4 py-2 flex justify-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => (
            <tr key={template.id}>
              <td className="border border-gray-300 px-4 py-2">{template.name}</td>
              <td className="border border-gray-300 px-4 py-2">
                {template.fileType === 'image' && template.fileUrl ? (
                  <a href={getFileUrl(template.fileUrl)} target="_blank" rel="noreferrer">
                    <img
                      src={getFileUrl(template.fileUrl)}
                      alt={template.name}
                      className="h-16 w-16 rounded object-cover border border-gray-200"
                    />
                  </a>
                ) : template.fileUrl ? (
                  <a
                    href={getFileUrl(template.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View file
                  </a>
                ) : (
                  <span className="text-gray-400">No file</span>
                )}
              </td>
              <td className="border border-gray-300 px-4 py-2">{template.description}</td>
              <td className="border border-gray-300 px-4 py-2">{template.fileType}</td>
              <td className="border border-gray-300 px-4 py-2">{new Date(template.createdAt).toLocaleString()}</td>
              <td className="border border-gray-300 px-4 py-2">
                <button
                  onClick={() => {
                    setSelectedTemplateId(template.id);
                    showDeleteConfirmModal(true);
                  }}
                  className="bg-red-500 text-white p-2 rounded"
                >
                  <TrashIcon className="h-5 w-5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add Template Modal */}
      {addTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={resetForm}>
          <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-lg relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={resetForm}
              className="absolute top-3 right-3 text-gray-600 hover:text-red-700 text-2xl font-bold"
            >&times;</button>

            <h4 className="text-black font-bold text-2xl mb-4 border-b pb-3">Add Template</h4>

            <input type="text" value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Enter Template Name" className="w-full mb-4 border rounded px-3 py-2" />
            <select value={selectedUploadType} onChange={(e) => setSelectedUploadType(e.target.value)} className="w-full mb-4 border rounded px-3 py-2">
              <option value="none">None</option>
              <option value="image">Image</option>
              <option value="attachment">Attachment</option>
            </select>
            {(selectedUploadType === "image" || selectedUploadType === "attachment") && (
              <input type="file" accept={selectedUploadType === 'image' ? 'image/*' : 'application/pdf'} onChange={(e) => setSelectedFile(e.target.files[0])} className="w-full mb-4 border rounded px-3 py-2" />
            )}
            <textarea rows={4} value={templateBody} onChange={(e) => setTemplateBody(e.target.value)} placeholder="Enter Template Body" className="w-full mb-4 border rounded px-3 py-2"></textarea>

            <div className="flex justify-end">
              <button onClick={handleSubmit} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={() => showDeleteConfirmModal(false)}>
          <div className="bg-white p-6 rounded-2xl shadow-2xl text-center w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-semibold mb-4">Are you sure you want to delete this template?</p>
            <div className="flex justify-center gap-4">
              <button onClick={confirmDelete} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700">Yes</button>
              <button onClick={() => showDeleteConfirmModal(false)} className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500">No</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplateScreen;
