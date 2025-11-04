import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCreatePerson, useUpdatePerson } from '@/hooks/usePersons';
import type { CreatePersonData, Person } from '@/types/person';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface PersonFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (person: Person) => void;
  mode?: 'create' | 'edit';
  existingPerson?: Person | null;
}

const PersonFormModal: React.FC<PersonFormModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess,
  mode = 'create',
  existingPerson = null
}) => {
  const [formData, setFormData] = useState<CreatePersonData>({
    name: { bo: '', en: '' },
    alt_names: [],
    bdrc: '',
    wiki: null
  });

  const createPersonMutation = useCreatePerson();
  const updatePersonMutation = useUpdatePerson();

  // Load existing person data when in edit mode
  useEffect(() => {
    if (mode === 'edit' && existingPerson) {
      setFormData({
        name: existingPerson.name,
        alt_names: existingPerson.alt_names,
        bdrc: existingPerson.bdrc,
        wiki: existingPerson.wiki
      });
    } else if (mode === 'create') {
      setFormData({
        name: { bo: '', en: '' },
        alt_names: [],
        bdrc: '',
        wiki: null
      });
    }
  }, [mode, existingPerson, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.name.en && !formData.name.bo) {
      alert('Please provide at least one name (English or Tibetan)');
      return;
    }

    // Clean up alt_names by removing id fields before sending to API
    const cleanFormData = {
      ...formData,
      alt_names: formData.alt_names.map(altName => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...cleanAltName } = altName;
        return cleanAltName;
      })
    };

    if (mode === 'create') {
      createPersonMutation.mutate(cleanFormData, {
        onSuccess: (createdPerson) => {
          setFormData({
            name: { bo: '', en: '' },
            alt_names: [],
            bdrc: '',
            wiki: null
          });
          onSuccess(createdPerson);
          onClose();
        },
        onError: (error) => {
          alert(`Error creating person: ${error.message}`);
        }
      });
    } else if (mode === 'edit' && existingPerson) {
      updatePersonMutation.mutate({
        id: existingPerson.id,
        ...cleanFormData
      }, {
        onSuccess: (updatedPerson) => {
          setFormData({
            name: { bo: '', en: '' },
            alt_names: [],
            bdrc: '',
            wiki: null
          });
          onSuccess(updatedPerson);
          onClose();
        },
        onError: (error) => {
          alert(`Error updating person: ${error.message}`);
        }
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'name_bo' || name === 'name_en') {
      const lang = name.split('_')[1];
      setFormData(prev => ({
        ...prev,
        name: { ...prev.name, [lang]: value }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const addAltName = () => {
    setFormData(prev => ({
      ...prev,
      alt_names: [...prev.alt_names, { en: '', bo: '', id: Date.now().toString() }]
    }));
  };

  const removeAltName = (index: number) => {
    setFormData(prev => ({
      ...prev,
      alt_names: prev.alt_names.filter((_, i) => i !== index)
    }));
  };

  const updateAltName = (index: number, lang: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      alt_names: prev.alt_names.map((altName, i) => 
        i === index ? { ...altName, [lang]: value } : altName
      )
    }));
  };

  const handleClose = () => {
    setFormData({
      name: { bo: '', en: '' },
      alt_names: [],
      bdrc: '',
      wiki: null
    });
    onClose();
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={handleClose}
      ></div>
      
      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-2xl font-bold text-gray-900">
            {mode === 'create' ? '✨ Create New Person' : '✏️ Edit Person'}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 hover:bg-white/80 rounded-full p-2 transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form - Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label htmlFor="name_bo" className="block text-sm font-semibold text-gray-700 mb-2">
                Name (Tibetan)
              </label>
              <input
                id="name_bo"
                type="text"
                name="name_bo"
                value={formData.name.bo || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter Tibetan name"
              />
            </div>
            <div>
              <label htmlFor="name_en" className="block text-sm font-semibold text-gray-700 mb-2">
                Name (English) <span className="text-red-500">*</span>
              </label>
              <input
                id="name_en"
                type="text"
                name="name_en"
                value={formData.name.en || ''}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="Enter English name"
              />
            </div>
          </div>
          
          {/* Alternative Names Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <span className="block text-sm font-semibold text-gray-700">Alternative Names</span>
              <button
                type="button"
                onClick={addAltName}
                className="text-sm bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm hover:shadow"
              >
                + Add Alternative Name
              </button>
            </div>
            {formData.alt_names.map((altName, index) => (
              <div key={altName.id || `alt-name-${index}`} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                <input
                  type="text"
                  value={altName.en || ''}
                  onChange={(e) => updateAltName(index, 'en', e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="English alternative name"
                />
                <input
                  type="text"
                  value={altName.bo || ''}
                  onChange={(e) => updateAltName(index, 'bo', e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  placeholder="Tibetan alternative name"
                />
                <button
                  type="button"
                  onClick={() => removeAltName(index)}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-3 rounded-lg transition-colors shadow-sm hover:shadow"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          {/* BDRC ID */}
          <div>
            <label htmlFor="bdrc" className="block text-sm font-semibold text-gray-700 mb-2">
              BDRC ID
            </label>
            <input
              id="bdrc"
              type="text"
              name="bdrc"
              value={formData.bdrc}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="Enter BDRC ID"
            />
          </div>

          {/* Wikipedia URL */}
          <div>
            <label htmlFor="wiki" className="block text-sm font-semibold text-gray-700 mb-2">
              Wikipedia URL
            </label>
            <input
              id="wiki"
              type="url"
              name="wiki"
              value={formData.wiki || ''}
              onChange={handleInputChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="https://en.wikipedia.org/wiki/..."
            />
          </div>
        </form>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="border-t border-gray-200 px-8 py-5 bg-gray-50 flex justify-end space-x-3">
          <Button
            type="button"
            onClick={handleClose}
            variant="outline"
            className="px-6 py-2.5"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={createPersonMutation.isPending || updatePersonMutation.isPending}
            className="px-6 py-2.5 shadow-sm hover:shadow"
          >
            {(createPersonMutation.isPending || updatePersonMutation.isPending) ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                {mode === 'create' ? 'Creating...' : 'Updating...'}
              </>
            ) : (
              mode === 'create' ? 'Create Person' : 'Update Person'
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PersonFormModal;

