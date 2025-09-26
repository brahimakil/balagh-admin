import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
}

interface Group {
  id: string;
  name: string;
  contacts: Contact[];
}

interface ContentItem {
  id: string;
  type: 'legend' | 'martyr' | 'location' | 'activity' | 'news' | 'liveNews';
  nameEn?: string;
  nameAr?: string;
  titleEn?: string;
  titleAr?: string;
  descriptionEn?: string;
  descriptionAr?: string;
  mainIcon?: string;
  mainImage?: string;
  createdAt: Date;
}

interface AllContent {
  legends: ContentItem[];
  martyrs: ContentItem[];
  locations: ContentItem[];
  activities: ContentItem[];
  news: ContentItem[];
  liveNews: ContentItem[];
}

const SimpleWhatsApp: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Add contact form
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '' });
  const [showAddContact, setShowAddContact] = useState(false);
  
  // Create group form
  const [groupName, setGroupName] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  // CSV import
  const [csvData, setCsvData] = useState('');
  const [showImport, setShowImport] = useState(false);

  // Active tab for messaging section
  const [activeTab, setActiveTab] = useState<'contacts' | 'groups' | 'mixed'>('contacts');

  const [allContent, setAllContent] = useState<AllContent>({
    legends: [],
    martyrs: [],
    locations: [],
    activities: [],
    news: [],
    liveNews: []
  });
  const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]);
  const [showContentSharing, setShowContentSharing] = useState(false);
  const [shareDelaySeconds, setShareDelaySeconds] = useState(5);

  const [contentSearchTerm, setContentSearchTerm] = useState('');
  const [selectedContentType, setSelectedContentType] = useState<string>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [currentContentPage, setCurrentContentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const BACKEND_URL = 'https://balaghwhatsapp-production.up.railway.app';

  useEffect(() => {
    const connectSocket = () => {
      const socket = io(BACKEND_URL);
      
      socket.on('connect', () => {
        console.log('Connected to server');
      });

      socket.on('qr-code', (data) => {
        setQrCode(data.qrCode);
        setConnected(false);
        setError(''); // Clear any previous errors
      });

      socket.on('whatsapp-ready', () => {
        setConnected(true);
        setQrCode('');
        setSuccess('WhatsApp connected successfully!');
      });

      socket.on('whatsapp-disconnected', (data) => {
        setConnected(false);
        setQrCode('');
        
        if (data.requiresReconnection) {
          setError(`WhatsApp disconnected: ${data.reason}. Please reconnect by clicking the Connect button.`);
        } else {
          setSuccess('WhatsApp disconnected successfully');
        }
      });

      socket.on('whatsapp-auth-failed', (data) => {
        setConnected(false);
        setQrCode('');
        setError(`Authentication failed: ${data.reason}. Please try connecting again.`);
      });

      return socket;
    };

    const socket = connectSocket();
    loadContacts();
    loadGroups();
    loadAllContent();

    return () => {
      socket.disconnect();
    };
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/status`);
      if (response.ok) {
        const data = await response.json();
        setConnected(data.connected);
      }
    } catch (error) {
      console.error('Failed to check connection status:', error);
    }
  };

  const connectWhatsApp = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/connect`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to connect');
      setSuccess('Connecting... Please scan QR code');
    } catch (error) {
      setError('Failed to connect WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const disconnectWhatsApp = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/disconnect`, {
        method: 'POST'
      });
      
      if (!response.ok) throw new Error('Failed to disconnect');
      setConnected(false);
      setSuccess('WhatsApp disconnected successfully');
    } catch (error) {
      setError('Failed to disconnect WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/contacts`);
      if (response.ok) {
        const data = await response.json();
        setContacts(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to load contacts:', response.status);
        setContacts([]);
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
      setContacts([]);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/groups`);
      if (response.ok) {
        const data = await response.json();
        setGroups(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to load groups:', response.status);
        setGroups([]);
      }
    } catch (error) {
      console.error('Failed to load groups:', error);
      setGroups([]);
    }
  };

  const loadAllContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/content`);
      if (!response.ok) throw new Error('Failed to load content');
      
      const content = await response.json();
      setAllContent(content);
    } catch (error) {
      setError('Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const addContact = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact)
      });
      
      if (!response.ok) throw new Error('Failed to add contact');
      
      setSuccess('Contact added successfully!');
      setNewContact({ name: '', phone: '', email: '' });
      setShowAddContact(false);
      loadContacts();
    } catch (error) {
      setError('Failed to add contact');
    } finally {
      setLoading(false);
    }
  };

  const deleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/contacts/${contactId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete contact');
      
      setSuccess('Contact deleted successfully!');
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
      loadContacts();
    } catch (error) {
      setError('Failed to delete contact');
    } finally {
      setLoading(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/groups/${groupId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Failed to delete group');
      
      setSuccess('Group deleted successfully!');
      setSelectedGroups(selectedGroups.filter(id => id !== groupId));
      loadGroups();
    } catch (error) {
      setError('Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  const importContacts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/contacts/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvData })
      });
      
      if (!response.ok) throw new Error('Failed to import');
      
      const result = await response.json();
      setSuccess(`Imported ${result.success.length} contacts, ${result.failed.length} failed`);
      setCsvData('');
      setShowImport(false);
      loadContacts();
    } catch (error) {
      setError('Failed to import contacts');
    } finally {
      setLoading(false);
    }
  };

  const exportContacts = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/contacts/export`);
      if (!response.ok) throw new Error('Failed to export');
      
      const csv = await response.text();
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'contacts.csv';
      link.click();
    } catch (error) {
      setError('Failed to export contacts');
    }
  };

  const createGroup = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!groupName.trim()) {
        setError('Please enter a group name');
        return;
      }
      
      if (selectedContacts.length === 0) {
        setError('Please select at least one contact');
        return;
      }
      
      console.log('Creating group:', { name: groupName, contactIds: selectedContacts });
      
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: groupName.trim(), // Changed from 'groupName' to 'name'
          contactIds: selectedContacts 
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create group');
      }
      
      const result = await response.json();
      setSuccess(`Group created successfully! ${result.whatsappGroupId ? '(Real WhatsApp group created)' : ''}`);
      setGroupName('');
      setSelectedContacts([]);
      setShowCreateGroup(false);
      loadGroups();
    } catch (error) {
      console.error('Create group error:', error);
      setError(error.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  // 📤 MESSAGING FUNCTIONS
  const sendToContacts = async () => {
    if (!connected) {
      setError('WhatsApp is not connected. Please connect first.');
      return;
    }

    if (selectedContacts.length === 0 || !message.trim()) {
      setError('Please select contacts and enter a message');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/send/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contactIds: selectedContacts, 
          message: message.trim() 
        })
      });
      
      if (!response.ok) throw new Error('Failed to send messages');
      
      const result = await response.json();
      setSuccess(`Messages sent! Success: ${result.success.length}, Failed: ${result.failed.length}`);
      
      if (result.failed.length > 0) {
        console.log('Failed sends:', result.failed);
      }
      
      setMessage('');
    } catch (error) {
      setError('Failed to send messages to contacts');
    } finally {
      setLoading(false);
    }
  };

  const sendToGroups = async () => {
    if (!connected) {
      setError('WhatsApp is not connected. Please connect first.');
      return;
    }

    if (selectedGroups.length === 0 || !message.trim()) {
      setError('Please select groups and enter a message');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const results = [];
      for (const groupId of selectedGroups) {
        const response = await fetch(`${BACKEND_URL}/api/whatsapp/send/group/${groupId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: message.trim() })
        });
        
        if (response.ok) {
          const result = await response.json();
          results.push(result);
        }
      }
      
      setSuccess(`Messages sent to ${selectedGroups.length} groups!`);
      setMessage('');
    } catch (error) {
      setError('Failed to send messages to groups');
    } finally {
      setLoading(false);
    }
  };

  const sendToSelection = async () => {
    if (!connected) {
      setError('WhatsApp is not connected. Please connect first.');
      return;
    }

    if (selectedContacts.length === 0 && selectedGroups.length === 0) {
      setError('Please select contacts and/or groups');
      return;
    }

    if (!message.trim()) {
      setError('Please enter a message');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/send/selection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          contactIds: selectedContacts, 
          groupIds: selectedGroups,
          message: message.trim() 
        })
      });
      
      if (!response.ok) throw new Error('Failed to send messages');
      
      const result = await response.json();
      
      const contactSuccessCount = result.contactResults?.success?.length || 0;
      const groupSuccessCount = result.groupResults?.success?.length || 0;
      
      setSuccess(`Messages sent! Contacts: ${contactSuccessCount}, Groups: ${groupSuccessCount}`);
      setMessage('');
    } catch (error) {
      setError('Failed to send messages');
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedContacts([]);
    setSelectedGroups([]);
  };

  const clearMessages = () => {
    setSuccess('');
    setError('');
  };

  const toggleContentSelection = (item: ContentItem) => {
    setSelectedContent(prev => {
      const exists = prev.find(c => c.id === item.id && c.type === item.type);
      if (exists) {
        return prev.filter(c => !(c.id === item.id && c.type === item.type));
                } else {
        return [...prev, item];
      }
    });
  };

  const selectAllFromCategory = (category: keyof AllContent) => {
    const categoryItems = allContent[category];
    const allSelected = categoryItems.every(item => 
      selectedContent.some(selected => selected.id === item.id && selected.type === item.type)
    );
    
    if (allSelected) {
      // Deselect all from this category
      setSelectedContent(prev => 
        prev.filter(selected => !categoryItems.some(item => 
          item.id === selected.id && item.type === selected.type
        ))
      );
    } else {
      // Select all from this category
      setSelectedContent(prev => {
        const newItems = categoryItems.filter(item => 
          !prev.some(selected => selected.id === item.id && selected.type === item.type)
        );
        return [...prev, ...newItems];
      });
    }
  };

  const shareSelectedContent = async () => {
    if (!connected) {
      setError('WhatsApp is not connected. Please connect first.');
      return;
    }

    if (selectedContent.length === 0) {
      setError('Please select content to share');
      return;
    }

    if (selectedContacts.length === 0 && selectedGroups.length === 0) {
      setError('Please select contacts or groups to share with');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedContent,
          contactIds: selectedContacts,
          groupIds: selectedGroups,
          delaySeconds: shareDelaySeconds
        })
      });
      
      if (!response.ok) throw new Error('Failed to share content');
      
      const results = await response.json();
      setSuccess(`Content shared! Success: ${results.success.length}, Failed: ${results.failed.length}`);
      
      if (results.failed.length > 0) {
        console.log('Failed shares:', results.failed);
      }
      
      // Clear selections
      setSelectedContent([]);
      setSelectedContacts([]);
      setSelectedGroups([]);
      setShowContentSharing(false);
    } catch (error) {
      setError('Failed to share content');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredContent = () => {
    let allItems: ContentItem[] = [];
    
    // Combine all content types
    if (selectedContentType === 'all' || selectedContentType === 'legends') {
      allItems = [...allItems, ...allContent.legends];
    }
    if (selectedContentType === 'all' || selectedContentType === 'martyrs') {
      allItems = [...allItems, ...allContent.martyrs];
    }
    if (selectedContentType === 'all' || selectedContentType === 'locations') {
      allItems = [...allItems, ...allContent.locations];
    }
    if (selectedContentType === 'all' || selectedContentType === 'activities') {
      allItems = [...allItems, ...allContent.activities];
    }
    if (selectedContentType === 'all' || selectedContentType === 'news') {
      allItems = [...allItems, ...allContent.news];
    }
    if (selectedContentType === 'all' || selectedContentType === 'liveNews') {
      allItems = [...allItems, ...allContent.liveNews];
    }

    // Filter by search term
    if (contentSearchTerm.trim()) {
      const searchLower = contentSearchTerm.toLowerCase();
      allItems = allItems.filter(item => 
        (item.nameAr || '').toLowerCase().includes(searchLower) ||
        (item.nameEn || '').toLowerCase().includes(searchLower) ||
        (item.titleAr || '').toLowerCase().includes(searchLower) ||
        (item.titleEn || '').toLowerCase().includes(searchLower) ||
        (item.descriptionAr || '').toLowerCase().includes(searchLower) ||
        (item.descriptionEn || '').toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return allItems;
  };

  const getPaginatedContent = () => {
    const filtered = getFilteredContent();
    const startIndex = (currentContentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return {
      items: filtered.slice(startIndex, endIndex),
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  };

  const toggleItemSelection = (item: ContentItem) => {
    const itemKey = `${item.type}-${item.id}`;
    const newSelected = new Set(selectedItems);
    
    if (newSelected.has(itemKey)) {
      newSelected.delete(itemKey);
    } else {
      newSelected.add(itemKey);
    }
    
    setSelectedItems(newSelected);
    
    // Update selectedContent for sharing
    const filteredContent = getFilteredContent();
    const newSelectedContent = filteredContent.filter(contentItem => 
      newSelected.has(`${contentItem.type}-${contentItem.id}`)
    );
    setSelectedContent(newSelectedContent);
  };

  const selectAllVisible = () => {
    const { items } = getPaginatedContent();
    const newSelected = new Set(selectedItems);
    
    items.forEach(item => {
      newSelected.add(`${item.type}-${item.id}`);
    });
    
    setSelectedItems(newSelected);
    
    // Update selectedContent
    const filteredContent = getFilteredContent();
    const newSelectedContent = filteredContent.filter(contentItem => 
      newSelected.has(`${contentItem.type}-${contentItem.id}`)
    );
    setSelectedContent(newSelectedContent);
  };

  const clearAllSelections = () => {
    setSelectedItems(new Set());
    setSelectedContent([]);
  };

  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'legend': return '🏛️';
      case 'martyr': return '🌹';
      case 'location': return '📍';
      case 'activity': return '🎯';
      case 'news': return '📰';
      case 'liveNews': return '🔴';
      default: return '📄';
    }
  };

  const getContentTitle = (item: ContentItem) => {
    return item.nameAr || item.nameEn || item.titleAr || item.titleEn || 'Untitled';
  };

  const getContentDescription = (item: ContentItem) => {
    const desc = item.descriptionAr || item.descriptionEn || '';
    return desc.length > 100 ? desc.substring(0, 100) + '...' : desc;
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📱 Simple WhatsApp Manager</h1>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
          <button onClick={clearMessages} className="btn-close">✕</button>
        </div>
      )}
      {success && (
        <div className="success-message">
          ✅ {success}
          <button onClick={clearMessages} className="btn-close">✕</button>
        </div>
      )}

      {/* CONNECTION SECTION */}
      <div className="section-card">
        <h2>🔗 WhatsApp Connection</h2>
        
        <div className="connection-status">
          <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>
        
        {!connected && !qrCode && (
          <button 
            onClick={connectWhatsApp} 
            disabled={loading}
            className="btn btn-primary"
          >
            {loading ? '⏳ Connecting...' : '📱 Connect WhatsApp'}
          </button>
        )}

        {connected && (
          <button 
            onClick={disconnectWhatsApp} 
            disabled={loading}
            className="btn btn-secondary"
          >
            {loading ? '⏳ Disconnecting...' : '🔌 Disconnect'}
          </button>
        )}
        
        {qrCode && (
          <div className="qr-section">
            <h3>📱 Scan this QR code with WhatsApp:</h3>
            <img src={qrCode} alt="WhatsApp QR Code" className="qr-code" />
            <p>Open WhatsApp → Settings → Linked Devices → Link a Device</p>
          </div>
        )}
      </div>

      {/* CONTACTS SECTION */}
      <div className="section-card">
        <h2>📇 Contacts ({contacts.length})</h2>
        
        <div className="action-buttons">
          <button onClick={() => setShowAddContact(!showAddContact)} className="btn btn-secondary">
            ➕ Add Contact
          </button>
          <button onClick={() => setShowImport(!showImport)} className="btn btn-secondary">
            📥 Import CSV
          </button>
          <button onClick={exportContacts} className="btn btn-secondary">
            📤 Export CSV
          </button>
          {selectedContacts.length > 0 && (
            <button onClick={() => setSelectedContacts([])} className="btn btn-warning">
              ❌ Clear Selection ({selectedContacts.length})
            </button>
          )}
        </div>

        {/* ADD CONTACT FORM */}
        {showAddContact && (
          <div className="form-section">
            <h3>Add New Contact</h3>
            <div className="form-group">
              <input
                type="text"
                placeholder="Name"
                value={newContact.name}
                onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                className="form-input"
              />
              <input
                type="text"
                placeholder="Phone (with country code, e.g., 96170123456)"
                value={newContact.phone}
                onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                className="form-input"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={newContact.email}
                onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                className="form-input"
              />
            </div>
            <div className="action-buttons">
              <button onClick={addContact} disabled={loading} className="btn btn-primary">
                ✅ Add Contact
              </button>
              <button onClick={() => setShowAddContact(false)} className="btn btn-secondary">
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {/* IMPORT CSV FORM */}
        {showImport && (
          <div className="form-section">
            <h3>Import Contacts from CSV</h3>
            <p>Format: Name,Phone,Email</p>
            <textarea
              value={csvData}
              onChange={(e) => setCsvData(e.target.value)}
              placeholder="John Doe,96170123456,john@example.com&#10;Jane Smith,96170654321,jane@example.com"
              className="form-textarea"
            />
            <div className="action-buttons">
              <button onClick={importContacts} disabled={loading} className="btn btn-primary">
                📥 Import
              </button>
              <button onClick={() => setShowImport(false)} className="btn btn-secondary">
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {/* CONTACTS LIST */}
        <div className="contacts-grid">
          {contacts.map(contact => (
            <div 
              key={contact.id} 
              className={`contact-card ${selectedContacts.includes(contact.id) ? 'selected' : ''}`}
              onClick={() => {
                if (selectedContacts.includes(contact.id)) {
                  setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                } else {
                  setSelectedContacts([...selectedContacts, contact.id]);
                }
              }}
            >
              <div className="contact-info">
                <strong>{contact.name}</strong><br />
                📞 {contact.phone}<br />
                {contact.email && <>📧 {contact.email}<br /></>}
                {selectedContacts.includes(contact.id) && <span className="selected-badge">✅ Selected</span>}
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  deleteContact(contact.id);
                }}
                className="btn-delete"
                title="Delete contact"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
        
        <p>Selected: {selectedContacts.length} contacts</p>
      </div>

      {/* GROUPS SECTION */}
      <div className="section-card">
        <h2>👥 Groups ({groups.length})</h2>
        
        <div className="action-buttons">
          <button 
            onClick={() => setShowCreateGroup(!showCreateGroup)} 
            disabled={selectedContacts.length === 0}
            className="btn btn-primary"
          >
            ➕ Create Group ({selectedContacts.length} selected)
          </button>
          {selectedGroups.length > 0 && (
            <button onClick={() => setSelectedGroups([])} className="btn btn-warning">
              ❌ Clear Selection ({selectedGroups.length})
            </button>
          )}
        </div>

        {/* CREATE GROUP FORM */}
        {showCreateGroup && (
          <div className="form-section">
            <h3>Create New Group</h3>
            <input
              type="text"
              placeholder="Group Name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="form-input"
            />
            <p>Selected contacts: {selectedContacts.length}</p>
            <div className="action-buttons">
              <button onClick={createGroup} disabled={loading || !groupName} className="btn btn-primary">
                ✅ Create Group
              </button>
              <button onClick={() => setShowCreateGroup(false)} className="btn btn-secondary">
                ❌ Cancel
              </button>
            </div>
          </div>
        )}

        {/* GROUPS LIST */}
        <div className="groups-list">
          {groups.map(group => (
            <div 
              key={group.id} 
              className={`group-card ${selectedGroups.includes(group.id) ? 'selected' : ''}`}
              onClick={() => {
                if (selectedGroups.includes(group.id)) {
                  setSelectedGroups(selectedGroups.filter(id => id !== group.id));
                } else {
                  setSelectedGroups([...selectedGroups, group.id]);
                }
              }}
            >
              <div className="group-header">
                <div className="group-info">
                  <h3>👥 {group.name}</h3>
                  <p>📊 {(group.contacts && Array.isArray(group.contacts)) ? group.contacts.length : 0} contacts</p>
                  {selectedGroups.includes(group.id) && <span className="selected-badge">✅ Selected</span>}
                </div>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteGroup(group.id);
                  }}
                  className="btn-delete"
                  title="Delete group"
                >
                  🗑️
                </button>
              </div>
              
              <details>
                <summary>👀 View contacts</summary>
                <div className="contacts-list">
                  {(group.contacts && Array.isArray(group.contacts)) ? group.contacts.map(contact => (
                    <div key={contact.id} className="contact-item">
                      {contact.name} - {contact.phone}
                    </div>
                  )) : <p>No contacts in this group</p>}
                </div>
              </details>
            </div>
          ))}
        </div>
        
        <p>Selected: {selectedGroups.length} groups</p>
      </div>

      {/* MESSAGING SECTION */}
      {(selectedContacts.length > 0 || selectedGroups.length > 0) && (
        <div className="section-card messaging-section">
          <h2>📤 Send Messages</h2>
          
          <div className="selection-summary">
            <p>
              <strong>Selected:</strong> {selectedContacts.length} contacts, {selectedGroups.length} groups
            </p>
            <button onClick={clearSelection} className="btn btn-warning">
              🗑️ Clear All Selection
            </button>
          </div>

          {/* Messaging Tabs */}
          <div className="tab-navigation">
            <button 
              className={`tab ${activeTab === 'contacts' ? 'active' : ''}`}
              onClick={() => setActiveTab('contacts')}
              disabled={selectedContacts.length === 0}
            >
              📱 Send to Contacts ({selectedContacts.length})
            </button>
            <button 
              className={`tab ${activeTab === 'groups' ? 'active' : ''}`}
              onClick={() => setActiveTab('groups')}
              disabled={selectedGroups.length === 0}
            >
              👥 Send to Groups ({selectedGroups.length})
            </button>
            <button 
              className={`tab ${activeTab === 'mixed' ? 'active' : ''}`}
              onClick={() => setActiveTab('mixed')}
              disabled={selectedContacts.length === 0 && selectedGroups.length === 0}
            >
              🔀 Send to All ({selectedContacts.length + selectedGroups.length})
            </button>
          </div>

          {/* Message Input */}
          <div className="message-form">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter your message here..."
              className="form-textarea"
              rows={4}
            />
            <p>Characters: {message.length}</p>

            {/* Send Buttons */}
            <div className="action-buttons">
              {activeTab === 'contacts' && (
                <button 
                  onClick={sendToContacts}
                  disabled={loading || !connected || selectedContacts.length === 0 || !message.trim()}
                  className="btn btn-primary"
                >
                  {loading ? '⏳ Sending...' : `📱 Send to ${selectedContacts.length} Contacts`}
                </button>
              )}

              {activeTab === 'groups' && (
                <button 
                  onClick={sendToGroups}
                  disabled={loading || !connected || selectedGroups.length === 0 || !message.trim()}
                  className="btn btn-primary"
                >
                  {loading ? '⏳ Sending...' : `👥 Send to ${selectedGroups.length} Groups`}
                </button>
              )}

              {activeTab === 'mixed' && (
                <button 
                  onClick={sendToSelection}
                  disabled={loading || !connected || (selectedContacts.length === 0 && selectedGroups.length === 0) || !message.trim()}
                  className="btn btn-primary"
                >
                  {loading ? '⏳ Sending...' : `🔀 Send to ${selectedContacts.length + selectedGroups.length} Recipients`}
                </button>
              )}

              <button 
                onClick={() => setMessage('')}
                className="btn btn-secondary"
              >
                🗑️ Clear Message
              </button>
            </div>

            {!connected && (
              <div className="warning-message">
                ⚠️ WhatsApp is not connected. Please connect first to send messages.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📤 IMPROVED CONTENT SHARING SECTION */}
      {showContentSharing && (
        <div className="content-sharing-modal">
          <div className="content-sharing-container">
            {/* Header */}
            <div className="content-sharing-header">
              <h3>📤 Share Content</h3>
              <button 
                onClick={() => setShowContentSharing(false)}
                className="btn btn-secondary btn-sm"
              >
                ✕ Close
              </button>
            </div>

            {/* Filters and Search */}
            <div className="content-filters">
              <div className="filter-row">
                {/* Content Type Filter */}
                <div className="filter-group">
                  <label>Content Type:</label>
                  <select 
                    value={selectedContentType} 
                    onChange={(e) => {
                      setSelectedContentType(e.target.value);
                      setCurrentContentPage(1);
                    }}
                    className="form-control"
                  >
                    <option value="all">All Types ({
                      allContent.legends.length + allContent.martyrs.length + 
                      allContent.locations.length + allContent.activities.length + 
                      allContent.news.length + allContent.liveNews.length
                    })</option>
                    <option value="legends">🏛️ Legends ({allContent.legends.length})</option>
                    <option value="martyrs">🌹 Martyrs ({allContent.martyrs.length})</option>
                    <option value="locations">📍 Locations ({allContent.locations.length})</option>
                    <option value="activities">🎯 Activities ({allContent.activities.length})</option>
                    <option value="news">📰 News ({allContent.news.length})</option>
                    <option value="liveNews">🔴 Live News ({allContent.liveNews.length})</option>
                  </select>
                </div>

                {/* Search */}
                <div className="filter-group">
                  <label>Search:</label>
                  <input
                    type="text"
                    placeholder="Search by name, title, or description..."
                    value={contentSearchTerm}
                    onChange={(e) => {
                      setContentSearchTerm(e.target.value);
                      setCurrentContentPage(1);
                    }}
                    className="form-control"
                  />
                </div>
              </div>

              {/* Selection Actions */}
              <div className="selection-actions">
                <button onClick={selectAllVisible} className="btn btn-outline-primary btn-sm">
                  ✅ Select All Visible
                </button>
                <button onClick={clearAllSelections} className="btn btn-outline-secondary btn-sm">
                  🗑️ Clear Selection
                </button>
                <span className="selection-count">
                  Selected: {selectedItems.size} items
                </span>
              </div>
            </div>

            {/* Content Grid */}
            <div className="content-grid">
              {(() => {
                const { items, totalItems } = getPaginatedContent();
                
                if (items.length === 0) {
                  return (
                    <div className="empty-state">
                      <p>No content found matching your criteria.</p>
                    </div>
                  );
                }

                return items.map(item => {
                  const itemKey = `${item.type}-${item.id}`;
                  const isSelected = selectedItems.has(itemKey);
                  
                  return (
                    <div 
                      key={itemKey}
                      className={`content-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleItemSelection(item)}
                    >
                      <div className="content-card-header">
                        <span className="content-type-badge">
                          {getContentTypeIcon(item.type)} {item.type}
                        </span>
                        {isSelected && <span className="selection-indicator">✓</span>}
                      </div>
                      
                      {(item.mainIcon || item.mainImage) && (
                        <div className="content-card-image">
                          <img 
                            src={item.mainIcon || item.mainImage} 
                            alt={getContentTitle(item)}
                            onError={(e) => { 
                              e.currentTarget.style.display = 'none'; 
                            }}
                            onLoad={(e) => {
                              // Ensure the image is properly sized
                              const img = e.currentTarget;
                              if (img.naturalHeight > img.naturalWidth) {
                                img.style.objectFit = 'contain';
                              }
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="content-card-body">
                        <h4 className="content-title">{getContentTitle(item)}</h4>
                        <p className="content-description">{getContentDescription(item)}</p>
                        <small className="content-date">
                          {new Date(item.createdAt).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Pagination */}
            {(() => {
              const { totalPages } = getPaginatedContent();
              
              if (totalPages <= 1) return null;
              
              return (
                <div className="content-pagination">
                  <button 
                    onClick={() => setCurrentContentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentContentPage === 1}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    ← Previous
                  </button>
                  
                  <span className="page-info">
                    Page {currentContentPage} of {totalPages}
                  </span>
                  
                  <button 
                    onClick={() => setCurrentContentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentContentPage === totalPages}
                    className="btn btn-outline-secondary btn-sm"
                  >
                    Next →
                  </button>
                </div>
              );
            })()}

            {/* Share Settings */}
            <div className="share-settings">
              <div className="setting-group">
                <label>Delay between messages (seconds):</label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={shareDelaySeconds}
                  onChange={(e) => setShareDelaySeconds(Number(e.target.value))}
                  className="form-control"
                />
              </div>
            </div>

            {/* Selected Summary */}
            <div className="selected-summary">
              <p><strong>Ready to Share:</strong> {selectedContent.length} content items</p>
              <p><strong>To:</strong> {selectedContacts.length} contacts, {selectedGroups.length} groups</p>
            </div>

            {/* Share Button */}
            <div className="action-buttons">
              <button 
                onClick={shareSelectedContent} 
                disabled={loading || selectedContent.length === 0 || (selectedContacts.length === 0 && selectedGroups.length === 0)}
                className="btn btn-success btn-lg"
              >
                📤 Share {selectedContent.length} Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add this button to your main interface */}
      <button 
        onClick={() => {
          setShowContentSharing(true);
          loadAllContent();
        }}
        className="btn btn-info"
        disabled={!connected}
      >
        📤 Share Content
      </button>
    </div>
  );
};

export default SimpleWhatsApp;
