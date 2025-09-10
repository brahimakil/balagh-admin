import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import io from 'socket.io-client';
import { martyrsService, type Martyr } from '../services/martyrsService';
import { newsService, type News } from '../services/newsService';
import { activitiesService, type Activity } from '../services/activitiesService';
import { locationsService, type Location } from '../services/locationsService';
import { legendsService, type Legend } from '../services/legendsService';

interface WhatsAppSession {
  id: string;
  sessionId: string;
  adminEmail: string;
  status: 'waiting_for_scan' | 'connected' | 'disconnected' | 'auth_failed';
  phoneNumber?: string;
  clientName?: string;
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Contact {
  id?: string;
  name: string;
  phoneNumber: string;
  notes?: string;
  addedBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface WhatsAppGroup {
  id?: string;
  groupId: string;
  groupName: string;
  memberCount: number;
  members: string[];
  sessionId: string;
  adminEmail: string;
  createdAt: Date;
}

type ContentType = 'martyrs' | 'news' | 'activities' | 'locations' | 'legends';

interface ContentItem {
  id: string;
  type: ContentType;
  nameEn: string;
  nameAr: string;
  data: Martyr | News | Activity | Location | Legend;
}

const WhatsApp: React.FC = () => {
  const [sessions, setSessions] = useState<WhatsAppSession[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Contact[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null);
  const [currentQR, setCurrentQR] = useState<string>('');
  const [message, setMessage] = useState('');
  const [groupMessage, setGroupMessage] = useState('');
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [socket, setSocket] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'connection' | 'contacts' | 'groups' | 'content' | 'messaging'>('connection');
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [groupSearch, setGroupSearch] = useState('');
  const [newContact, setNewContact] = useState<Partial<Contact>>({
    name: '',
    phoneNumber: '',
    notes: ''
  });

  // Content selection state
  const [contentType, setContentType] = useState<ContentType>('martyrs');
  const [contentItems, setContentItems] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<ContentItem[]>([]);
  const [contentSearch, setContentSearch] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);
  
  // Countdown state
  const [sendCooldown, setSendCooldown] = useState(0);
  
  const { currentUser, hasPermission } = useAuth();
  const BACKEND_URL = 'http://localhost:3001';

  useEffect(() => {
    if (!hasPermission('whatsapp')) {
      setError('You do not have permission to access WhatsApp features');
      return;
    }

    // Initialize Socket.IO connection
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    // Listen for WhatsApp events
    newSocket.on('qr-code', (data: { sessionId: string; qrCode: string }) => {
      console.log('📋 QR Code received:', data.sessionId);
      setCurrentQR(data.qrCode);
    });

    newSocket.on('client-ready', (data: { sessionId: string; phoneNumber: string; clientName: string }) => {
      console.log('✅ WhatsApp connected:', data);
      setCurrentQR('');
      setSuccess(`WhatsApp connected! Phone: ${data.phoneNumber}`);
      loadSessions();
      loadGroups();
    });

    newSocket.on('client-disconnected', (data: { sessionId: string; reason: string }) => {
      console.log('📱 WhatsApp disconnected:', data);
      setError(`WhatsApp disconnected: ${data.reason}`);
      loadSessions();
    });

    newSocket.on('auth-failure', (data: { sessionId: string }) => {
      console.log('❌ Authentication failed:', data);
      setError('WhatsApp authentication failed. Please try again.');
      setCurrentQR('');
    });

    newSocket.on('bulk-message-progress', (data: { current: number; total: number; phoneNumber: string }) => {
      const contact = contacts.find(c => c.phoneNumber === data.phoneNumber);
      const displayName = contact ? contact.name : data.phoneNumber;
      setSuccess(`Sending messages... ${data.current}/${data.total} (${displayName})`);
    });

    // Load existing data
    loadSessions();
    loadContacts();
    loadGroups();

    return () => {
      newSocket.disconnect();
    };
  }, [hasPermission]);

  // Load content when content type changes
  useEffect(() => {
    if (activeTab === 'content') {
      loadContent();
    }
  }, [contentType, activeTab]);

  // Countdown timer
  useEffect(() => {
    if (sendCooldown > 0) {
      const timer = setTimeout(() => {
        setSendCooldown(sendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [sendCooldown]);

  const loadSessions = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/sessions`);
      
      if (!response.ok) {
        console.log('No WhatsApp sessions available or server not running');
        setSessions([]);
        return;
      }
      
      const data = await response.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading sessions:', error);
      setSessions([]);
    }
  };

  const loadContacts = async () => {
    try {
      const savedContacts = localStorage.getItem('whatsapp-contacts');
      if (savedContacts) {
        const parsed = JSON.parse(savedContacts);
        setContacts(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      setContacts([]);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/groups`);
      
      if (!response.ok) {
        console.log('No WhatsApp groups available');
        setGroups([]);
        return;
      }
      
      const data = await response.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading groups:', error);
      setGroups([]);
    }
  };

  const loadContent = async () => {
    setLoadingContent(true);
    try {
      let items: ContentItem[] = [];
      
      switch (contentType) {
        case 'martyrs':
          const martyrs = await martyrsService.getAllMartyrs();
          items = martyrs.map(martyr => ({
            id: martyr.id!,
            type: 'martyrs' as ContentType,
            nameEn: martyr.nameEn,
            nameAr: martyr.nameAr,
            data: martyr
          }));
          break;
          
        case 'news':
          const news = await newsService.getAllNews();
          items = news.map(newsItem => ({
            id: newsItem.id!,
            type: 'news' as ContentType,
            nameEn: newsItem.titleEn,
            nameAr: newsItem.titleAr,
            data: newsItem
          }));
          break;
          
        case 'activities':
          const activities = await activitiesService.getAllActivities();
          items = activities.map(activity => ({
            id: activity.id!,
            type: 'activities' as ContentType,
            nameEn: activity.nameEn,
            nameAr: activity.nameAr,
            data: activity
          }));
          break;
          
        case 'locations':
          const locations = await locationsService.getAllLocations();
          items = locations.map(location => ({
            id: location.id!,
            type: 'locations' as ContentType,
            nameEn: location.nameEn,
            nameAr: location.nameAr,
            data: location
          }));
          break;
          
        case 'legends':
          const legends = await legendsService.getAllLegends();
          items = legends.map(legend => ({
            id: legend.id!,
            type: 'legends' as ContentType,
            nameEn: legend.nameEn,
            nameAr: legend.nameAr,
            data: legend
          }));
          break;
      }
      
      setContentItems(items);
    } catch (error) {
      console.error('Error loading content:', error);
      setError(`Failed to load ${contentType}`);
    } finally {
      setLoadingContent(false);
    }
  };

  const formatContentMessage = (item: ContentItem): string => {
    const { data, type } = item;
    let message = '';
    let mediaUrls: string[] = [];

    switch (type) {
      case 'martyrs':
        const martyr = data as Martyr;
        message = `🕊️ *${martyr.nameEn || 'N/A'}* | *${martyr.nameAr || 'N/A'}*\n\n`;
        
        // Handle jihadist name (check for both possible field names)
        const jihadistEn = martyr.jihadistNameEn || (martyr as any).warNameEn || 'N/A';
        const jihadistAr = martyr.jihadistNameAr || (martyr as any).warNameAr || 'N/A';
        message += `⚔️ Jihadist Name: ${jihadistEn} | ${jihadistAr}\n`;
        
        // Date of Shahada
        const shahadadDate = martyr.dateOfShahada ? new Date(martyr.dateOfShahada).toLocaleDateString() : 'N/A';
        message += `📅 Date of Shahada: ${shahadadDate}\n`;
        
        // Date of Birth
        const dobDate = martyr.dob ? new Date(martyr.dob).toLocaleDateString() : 'N/A';
        message += `📅 Date of Birth: ${dobDate}\n`;
        
        // Place of Birth - handle both field structures
        const birthEn = martyr.placeOfBirthEn || (martyr as any).placeOfBirth || 'N/A';
        const birthAr = martyr.placeOfBirthAr || 'N/A';
        message += `🏠 Place of Birth: ${birthEn} | ${birthAr}\n`;
        
        // Burial Place - handle both field structures  
        const burialEn = martyr.burialPlaceEn || (martyr as any).burialPlace || 'N/A';
        const burialAr = martyr.burialPlaceAr || 'N/A';
        message += `⚰️ Burial Place: ${burialEn} | ${burialAr}\n`;
        
        // Family Status
        message += `👨‍👩‍👧‍👦 Family Status: ${martyr.familyStatus || 'N/A'}\n`;
        
        // Number of Children (if married)
        if (martyr.familyStatus === 'married' && martyr.numberOfChildren) {
          const childrenCount = typeof martyr.numberOfChildren === 'string' ? 
                              martyr.numberOfChildren : 
                              martyr.numberOfChildren.toString();
          message += `👶 Number of Children: ${childrenCount}\n`;
        }
        
        // Story
        message += `\n📖 Story:\n`;
        if (martyr.storyEn) {
          message += `EN: ${martyr.storyEn}\n\n`;
        }
        if (martyr.storyAr) {
          message += `AR: ${martyr.storyAr}\n`;
        }
        
        // Add media URLs
        if (martyr.mainIcon) {
          mediaUrls.push(`📸 Main Icon: ${martyr.mainIcon}`);
        }
        
        // Photos
        if (martyr.photos && Array.isArray(martyr.photos)) {
          martyr.photos.forEach((photo, i) => {
            if (photo.url) {
              mediaUrls.push(`📷 Photo ${i + 1}: ${photo.url}`);
            }
          });
        }
        
        // Videos
        if (martyr.videos && Array.isArray(martyr.videos)) {
          martyr.videos.forEach((video, i) => {
            if (video.url) {
              mediaUrls.push(`🎥 Video ${i + 1}: ${video.url}`);
            }
          });
        }
        
        // QR Code (if available)
        if (martyr.qrCode && !martyr.qrCode.startsWith('data:image')) {
          // Only include if it's a URL, not base64 data
          mediaUrls.push(`🔗 QR Code: ${martyr.qrCode}`);
        }
        break;

      case 'news':
        const news = data as News;
        message = `📰 *${news.titleEn || 'N/A'}* | *${news.titleAr || 'N/A'}*\n\n`;
        
        // Description
        message += `📝 Description:\n`;
        if (news.descriptionEn) {
          message += `EN: ${news.descriptionEn}\n\n`;
        }
        if (news.descriptionAr) {
          message += `AR: ${news.descriptionAr}\n\n`;
        }
        
        // Dates and Type
        message += `📅 Created: ${new Date(news.createdAt).toLocaleDateString()}\n`;
        message += `🏷️ Type: ${news.type.toUpperCase()}\n`;
        
        // Live news specific info
        if (news.type === 'live' || news.type === 'regularLive') {
          message += `⏰ Live Duration: ${news.liveDurationHours || 24} hours\n`;
          if (news.liveStartTime) {
            message += `🕐 Live Start: ${new Date(news.liveStartTime).toLocaleString()}\n`;
          }
        }
        
        // Media URLs
        if (news.mainImage) {
          mediaUrls.push(`📸 Main Image: ${news.mainImage}`);
        }
        
        if (news.photos && Array.isArray(news.photos)) {
          news.photos.forEach((photo, i) => {
            if (photo.url) {
              mediaUrls.push(`📷 Photo ${i + 1}: ${photo.url}`);
            }
          });
        }
        
        if (news.videos && Array.isArray(news.videos)) {
          news.videos.forEach((video, i) => {
            if (video.url) {
              mediaUrls.push(`🎥 Video ${i + 1}: ${video.url}`);
            }
          });
        }
        break;

      case 'activities':
        const activity = data as Activity;
        message = `🎯 *${activity.nameEn || 'N/A'}* | *${activity.nameAr || 'N/A'}*\n\n`;
        
        // Description
        message += `📝 Description:\n`;
        if (activity.descriptionEn) {
          message += `EN: ${activity.descriptionEn}\n\n`;
        }
        if (activity.descriptionAr) {
          message += `AR: ${activity.descriptionAr}\n\n`;
        }
        
        // Activity details
        message += `📅 Date: ${new Date(activity.date).toLocaleDateString()}\n`;
        message += `🕐 Time: ${activity.time}\n`;
        message += `⏱️ Duration: ${activity.durationHours} hours\n`;
        message += `🔒 Privacy: ${activity.isPrivate ? 'Private' : 'Public'}\n`;
        message += `✅ Status: ${activity.status.toUpperCase()}\n`;
        message += `⚡ Active: ${activity.isActive ? 'Yes' : 'No'}\n`;
        
        if (activity.isManuallyReactivated) {
          message += `🔄 Manually Reactivated: Yes\n`;
        }
        
        // Media URLs
        if (activity.mainImage) {
          mediaUrls.push(`📸 Main Image: ${activity.mainImage}`);
        }
        
        if (activity.photos && Array.isArray(activity.photos)) {
          activity.photos.forEach((photo, i) => {
            if (photo.url) {
              mediaUrls.push(`📷 Photo ${i + 1}: ${photo.url}`);
            }
          });
        }
        
        if (activity.videos && Array.isArray(activity.videos)) {
          activity.videos.forEach((video, i) => {
            if (video.url) {
              mediaUrls.push(`🎥 Video ${i + 1}: ${video.url}`);
            }
          });
        }
        break;

      case 'locations':
        const location = data as Location;
        message = `📍 *${location.nameEn || 'N/A'}* | *${location.nameAr || 'N/A'}*\n\n`;
        
        // Description
        message += `📝 Description:\n`;
        if (location.descriptionEn) {
          message += `EN: ${location.descriptionEn}\n\n`;
        }
        if (location.descriptionAr) {
          message += `AR: ${location.descriptionAr}\n\n`;
        }
        
        // Location details
        message += `🌍 Coordinates: ${location.latitude}, ${location.longitude}\n`;
        message += `📅 Added: ${new Date(location.createdAt).toLocaleDateString()}\n`;
        
        // Media URLs
        if (location.mainImage) {
          mediaUrls.push(`📸 Main Image: ${location.mainImage}`);
        }
        
        if (location.photos && Array.isArray(location.photos)) {
          location.photos.forEach((photo, i) => {
            if (photo.url) {
              mediaUrls.push(`�� Photo ${i + 1}: ${photo.url}`);
            }
          });
        }
        
        if (location.videos && Array.isArray(location.videos)) {
          location.videos.forEach((video, i) => {
            if (video.url) {
              mediaUrls.push(`🎥 Video ${i + 1}: ${video.url}`);
            }
          });
        }
        
        if (location.photos360 && Array.isArray(location.photos360)) {
          location.photos360.forEach((photo, i) => {
            if (photo.url) {
              mediaUrls.push(`🌐 360° Photo ${i + 1}: ${photo.url}`);
            }
          });
        }
        break;

      case 'legends':
        const legend = data as Legend;
        message = `⭐ *${legend.nameEn || 'N/A'}* | *${legend.nameAr || 'N/A'}*\n\n`;
        
        // Description
        message += `📝 Description:\n`;
        if (legend.descriptionEn) {
          message += `EN: ${legend.descriptionEn}\n\n`;
        }
        if (legend.descriptionAr) {
          message += `AR: ${legend.descriptionAr}\n\n`;
        }
        
        message += `📅 Added: ${new Date(legend.createdAt).toLocaleDateString()}\n`;
        
        // Media URLs
        if (legend.mainIcon) {
          mediaUrls.push(`📸 Main Icon: ${legend.mainIcon}`);
        }
        break;
    }

    // Add media URLs to message if any exist
    if (mediaUrls.length > 0) {
      message += `\n📎 Media Files:\n${mediaUrls.join('\n')}`;
    }

    return message;
  };

  const startCooldown = () => {
    setSendCooldown(3);
  };

  const saveContacts = (contactsToSave: Contact[]) => {
    try {
      localStorage.setItem('whatsapp-contacts', JSON.stringify(contactsToSave));
      setContacts(contactsToSave);
    } catch (error) {
      console.error('Error saving contacts:', error);
      setError('Failed to save contact. Please try again.');
    }
  };

  const addContact = () => {
    if (!newContact.name?.trim() || !newContact.phoneNumber?.trim()) {
      setError('Please enter both name and phone number');
      return;
    }

    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = newContact.phoneNumber.replace(/\s/g, '');
    if (!phoneRegex.test(cleanPhone)) {
      setError('Please enter a valid phone number with country code (e.g., +1234567890)');
      return;
    }

    const existingContact = contacts.find(c => 
      c.phoneNumber === cleanPhone || 
      c.name.toLowerCase() === newContact.name.toLowerCase()
    );

    if (existingContact) {
      setError('Contact with this name or phone number already exists');
      return;
    }

    const contact: Contact = {
      id: Date.now().toString(),
      name: newContact.name.trim(),
      phoneNumber: cleanPhone,
      notes: newContact.notes?.trim() || '',
      addedBy: currentUser?.email || '',
      createdAt: new Date()
    };

    const updatedContacts = [...contacts, contact];
    saveContacts(updatedContacts);

    setNewContact({ name: '', phoneNumber: '', notes: '' });
    setShowAddContact(false);
    setSuccess(`Contact "${contact.name}" added successfully`);
    setError('');
  };

  const deleteContact = (contactId: string) => {
    if (confirm('Are you sure you want to delete this contact?')) {
      const updatedContacts = contacts.filter(c => c.id !== contactId);
      saveContacts(updatedContacts);
      setSelectedContacts(selectedContacts.filter(c => c.id !== contactId));
      setSuccess('Contact deleted successfully');
    }
  };

  const toggleContactSelection = (contact: Contact) => {
    const isSelected = selectedContacts.some(c => c.id === contact.id);
    if (isSelected) {
      setSelectedContacts(selectedContacts.filter(c => c.id !== contact.id));
    } else {
      setSelectedContacts([...selectedContacts, contact]);
    }
  };

  const toggleContentSelection = (item: ContentItem) => {
    const isSelected = selectedContent.some(c => c.id === item.id);
    if (isSelected) {
      setSelectedContent(selectedContent.filter(c => c.id !== item.id));
    } else {
      setSelectedContent([...selectedContent, item]);
    }
  };

  const selectAllContacts = () => {
    const filteredContacts = getFilteredContacts();
    setSelectedContacts(filteredContacts);
  };

  const selectAllContent = () => {
    const filteredContent = getFilteredContent();
    setSelectedContent(filteredContent);
  };

  const clearSelection = () => {
    setSelectedContacts([]);
    setSelectedGroup(null);
    setSelectedContent([]);
  };

  const getFilteredContacts = () => {
    return contacts.filter(contact =>
      contact.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
      contact.phoneNumber.includes(contactSearch)
    );
  };

  const getFilteredGroups = () => {
    return groups.filter(group =>
      group.groupName.toLowerCase().includes(groupSearch.toLowerCase())
    );
  };

  const getFilteredContent = () => {
    return contentItems.filter(item =>
      item.nameEn.toLowerCase().includes(contentSearch.toLowerCase()) ||
      item.nameAr.toLowerCase().includes(contentSearch.toLowerCase())
    );
  };

  const connectWhatsApp = async () => {
    try {
      setLoading('connecting');
      setError('');
      setSuccess('');

      const sessionId = `session_${Date.now()}`;
      
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          adminEmail: currentUser?.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to create WhatsApp session');
      }

      setSuccess('QR Code generated! Please scan with your WhatsApp mobile app.');
      
    } catch (error: any) {
      console.error('WhatsApp connection error:', error);
      setError(error.message || 'Failed to connect to WhatsApp service');
    } finally {
      setLoading(null);
    }
  };

  const sendContentMessages = async (isGroup: boolean = false) => {
    if (sendCooldown > 0) {
      setError(`Please wait ${sendCooldown} seconds before sending again`);
      return;
    }

    if (!selectedContent.length) {
      setError('Please select content to send');
      return;
    }

    if (!isGroup && !selectedContacts.length) {
      setError('Please select contacts to send to');
      return;
    }

    if (isGroup && !selectedGroup) {
      setError('Please select a group to send to');
      return;
    }

    const connectedSession = sessions.find(s => s.status === 'connected');
    if (!connectedSession) {
      setError('No connected WhatsApp session found');
      return;
    }

    try {
      setLoading(isGroup ? 'sending-group-content' : 'sending-content');
      setError('');

      // Send each content item as a separate message
      for (let i = 0; i < selectedContent.length; i++) {
        const contentItem = selectedContent[i];
        const formattedMessage = formatContentMessage(contentItem);

        if (isGroup) {
          // Send to group
          const response = await fetch(`${BACKEND_URL}/api/whatsapp/send-group-message`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: connectedSession.sessionId,
              groupId: selectedGroup!.groupId,
              message: formattedMessage,
              adminEmail: currentUser?.email
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Server error' }));
            throw new Error(errorData.error || 'Failed to send group message');
          }
        } else {
          // Send to contacts
          const phoneNumbers = selectedContacts.map(c => c.phoneNumber);

          const response = await fetch(`${BACKEND_URL}/api/whatsapp/send-bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: connectedSession.sessionId,
              phoneNumbers,
              message: formattedMessage,
              adminEmail: currentUser?.email
            })
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Server error' }));
            throw new Error(errorData.error || 'Failed to send bulk messages');
          }
        }

        // Add delay between messages
        if (i < selectedContent.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      const target = isGroup ? `group "${selectedGroup!.groupName}"` : `${selectedContacts.length} contact(s)`;
      setSuccess(`${selectedContent.length} content item(s) sent to ${target}!`);
      
      // Start cooldown
      startCooldown();
      
    } catch (error: any) {
      console.error('Content message error:', error);
      setError(error.message || 'Failed to send content messages');
    } finally {
      setLoading(null);
    }
  };

  const sendBulkMessage = async () => {
    if (sendCooldown > 0) {
      setError(`Please wait ${sendCooldown} seconds before sending again`);
      return;
    }

    if (!selectedContacts.length || !message.trim()) {
      setError('Please select contacts and enter a message');
      return;
    }

    const connectedSession = sessions.find(s => s.status === 'connected');
    if (!connectedSession) {
      setError('No connected WhatsApp session found');
      return;
    }

    try {
      setLoading('sending');
      setError('');

      const phoneNumbers = selectedContacts.map(c => c.phoneNumber);

      const response = await fetch(`${BACKEND_URL}/api/whatsapp/send-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: connectedSession.sessionId,
          phoneNumbers,
          message: message.trim(),
          adminEmail: currentUser?.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to send bulk messages');
      }

      const result = await response.json();
      const successCount = result.results?.filter((r: any) => r.success).length || 0;
      setSuccess(`Messages sent to ${successCount}/${selectedContacts.length} contacts`);
      setMessage('');
      
      // Start cooldown
      startCooldown();
      
    } catch (error: any) {
      console.error('Bulk message error:', error);
      setError(error.message || 'Failed to send messages');
    } finally {
      setLoading(null);
    }
  };

  const sendGroupMessage = async () => {
    if (sendCooldown > 0) {
      setError(`Please wait ${sendCooldown} seconds before sending again`);
      return;
    }

    if (!selectedGroup || !groupMessage.trim()) {
      setError('Please select a group and enter a message');
      return;
    }

    const connectedSession = sessions.find(s => s.status === 'connected');
    if (!connectedSession) {
      setError('No connected WhatsApp session found');
      return;
    }

    try {
      setLoading('sending-group');
      setError('');

      const response = await fetch(`${BACKEND_URL}/api/whatsapp/send-group-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: connectedSession.sessionId,
          groupId: selectedGroup.groupId,
          message: groupMessage.trim(),
          adminEmail: currentUser?.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to send group message');
      }

      setSuccess(`Message sent to group "${selectedGroup.groupName}"!`);
      setGroupMessage('');
      
      // Start cooldown
      startCooldown();
      
    } catch (error: any) {
      console.error('Group message error:', error);
      setError(error.message || 'Failed to send group message');
    } finally {
      setLoading(null);
    }
  };

  const createGroup = async () => {
    if (!selectedContacts.length || !groupName.trim()) {
      setError('Please select contacts and enter a group name');
      return;
    }

    const connectedSession = sessions.find(s => s.status === 'connected');
    if (!connectedSession) {
      setError('No connected WhatsApp session found');
      return;
    }

    try {
      setLoading('creating-group');
      setError('');

      const phoneNumbers = selectedContacts.map(c => c.phoneNumber);

      const response = await fetch(`${BACKEND_URL}/api/whatsapp/create-group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: connectedSession.sessionId,
          groupName: groupName.trim(),
          phoneNumbers,
          adminEmail: currentUser?.email
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to create group');
      }

      const result = await response.json();
      setSuccess(`WhatsApp group "${result.groupName || groupName.trim()}" created with ${selectedContacts.length} members!`);
      setGroupName('');
      loadGroups();
      
    } catch (error: any) {
      console.error('Group creation error:', error);
      setError(error.message || 'Failed to create group');
    } finally {
      setLoading(null);
    }
  };

  const disconnectSession = async (sessionId: string) => {
    try {
      setLoading(`disconnect-${sessionId}`);
      
      const response = await fetch(`${BACKEND_URL}/api/whatsapp/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to disconnect session');
      }

      setSuccess('WhatsApp session disconnected');
      loadSessions();
      
    } catch (error: any) {
      console.error('Disconnect error:', error);
      setError(error.message || 'Failed to disconnect');
    } finally {
      setLoading(null);
    }
  };

  const clearMessages = () => {
    setSuccess('');
    setError('');
  };

  if (!hasPermission('whatsapp')) {
    return (
      <div className="admin-content">
        <div className="admin-header">
          <h1>❌ Access Denied</h1>
          <p>You do not have permission to access WhatsApp features</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-content">
      <div className="admin-header">
        <h1>📱 WhatsApp Management</h1>
        <p>Connect and manage WhatsApp Business automation</p>
        {sendCooldown > 0 && (
          <div className="cooldown-indicator">
            ⏱️ Send cooldown: {sendCooldown} seconds
          </div>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={clearMessages}>✕</button>
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
          <button onClick={clearMessages}>✕</button>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="whatsapp-tabs">
        <button 
          className={`tab-btn ${activeTab === 'connection' ? 'active' : ''}`}
          onClick={() => setActiveTab('connection')}
        >
          📱 Connection
        </button>
        <button 
          className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          👥 Contacts ({contacts.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          👥 Groups ({groups.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          📚 Content ({selectedContent.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'messaging' ? 'active' : ''}`}
          onClick={() => setActiveTab('messaging')}
          disabled={!Array.isArray(sessions) || !sessions.some(s => s.status === 'connected')}
        >
          💬 Messaging
        </button>
      </div>

      {/* Connection Tab */}
      {activeTab === 'connection' && (
        <div className="whatsapp-section">
          <div className="section-header">
            <h2>📱 WhatsApp Connection</h2>
            <button 
              className="connect-btn"
              onClick={connectWhatsApp}
              disabled={loading === 'connecting'}
            >
              {loading === 'connecting' ? '⏳ Connecting...' : '📱 Connect New WhatsApp'}
            </button>
          </div>

          {currentQR && (
            <div className="qr-section">
              <h3>📋 Scan QR Code with WhatsApp</h3>
              <div className="qr-container">
                <img src={currentQR} alt="WhatsApp QR Code" className="qr-image" />
              </div>
              <p>Open WhatsApp → Settings → Linked Devices → Link a Device</p>
            </div>
          )}

          {/* Active Sessions */}
          <div className="sessions-list">
            <h3>📋 Active Sessions</h3>
            {!Array.isArray(sessions) || sessions.length === 0 ? (
              <p>No WhatsApp sessions found</p>
            ) : (
              <div className="sessions-grid">
                {sessions.map(session => (
                  <div key={session.id} className={`session-card ${session.status}`}>
                    <div className="session-info">
                      <h4>{session.phoneNumber || 'Pending Connection'}</h4>
                      <p className="session-status">
                        Status: <span className={`status-${session.status}`}>
                          {session.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </p>
                      {session.clientName && <p>Name: {session.clientName}</p>}
                      <p>Created: {new Date(session.createdAt).toLocaleString()}</p>
                    </div>
                    {session.status === 'connected' && (
                      <button 
                        className="disconnect-btn"
                        onClick={() => disconnectSession(session.sessionId)}
                        disabled={loading === `disconnect-${session.sessionId}`}
                      >
                        🔌 Disconnect
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === 'contacts' && (
        <div className="whatsapp-section">
          <div className="section-header">
            <h2>👥 Contact Management</h2>
            <button 
              className="add-contact-btn"
              onClick={() => setShowAddContact(true)}
            >
              ➕ Add Contact
            </button>
          </div>

          {/* Add Contact Form */}
          {showAddContact && (
            <div className="add-contact-form">
              <div className="form-header">
                <h3>Add New Contact</h3>
                <button onClick={() => setShowAddContact(false)}>✕</button>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    type="text"
                    value={newContact.name || ''}
                    onChange={(e) => setNewContact({...newContact, name: e.target.value})}
                    placeholder="Enter contact name"
                  />
                </div>
                <div className="form-group">
                  <label>Phone Number *</label>
                  <input
                    type="text"
                    value={newContact.phoneNumber || ''}
                    onChange={(e) => setNewContact({...newContact, phoneNumber: e.target.value})}
                    placeholder="+1234567890"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <input
                  type="text"
                  value={newContact.notes || ''}
                  onChange={(e) => setNewContact({...newContact, notes: e.target.value})}
                  placeholder="Optional notes about this contact"
                />
              </div>
              <div className="form-actions">
                <button className="save-btn" onClick={addContact}>
                  💾 Save Contact
                </button>
                <button className="cancel-btn" onClick={() => setShowAddContact(false)}>
                  ❌ Cancel
                </button>
              </div>
            </div>
          )}

          {/* Search and Filter */}
          <div className="contacts-controls">
            <div className="search-box">
              <input
                type="text"
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="🔍 Search contacts by name or number..."
                className="search-input"
              />
            </div>
            <div className="selection-info">
              {selectedContacts.length > 0 && (
                <span className="selected-count">
                  {selectedContacts.length} selected
                </span>
              )}
            </div>
          </div>

          {/* Contacts List */}
          <div className="contacts-list">
            {getFilteredContacts().length === 0 ? (
              <div className="no-contacts">
                {contacts.length === 0 ? (
                  <p>No contacts found. Add your first contact!</p>
                ) : (
                  <p>No contacts match your search.</p>
                )}
              </div>
            ) : (
              <>
                <div className="contacts-actions">
                  <button className="select-all-btn" onClick={selectAllContacts}>
                    ✅ Select All
                  </button>
                  <button className="clear-selection-btn" onClick={clearSelection}>
                    ❌ Clear Selection
                  </button>
                </div>
                <div className="contacts-grid">
                  {getFilteredContacts().map(contact => (
                    <div 
                      key={contact.id} 
                      className={`contact-card ${selectedContacts.some(c => c.id === contact.id) ? 'selected' : ''}`}
                      onClick={() => toggleContactSelection(contact)}
                    >
                      <div className="contact-info">
                        <h4>{contact.name}</h4>
                        <p className="phone">{contact.phoneNumber}</p>
                        {contact.notes && <p className="notes">{contact.notes}</p>}
                        <p className="added-date">
                          Added: {new Date(contact.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="contact-actions">
                        <button 
                          className="delete-contact-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteContact(contact.id!);
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Groups Tab */}
      {activeTab === 'groups' && (
        <div className="whatsapp-section">
          <div className="section-header">
            <h2>👥 Groups Management</h2>
          </div>

          {/* Search Groups */}
          <div className="search-box">
            <input
              type="text"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              placeholder="🔍 Search groups by name..."
              className="search-input"
            />
          </div>

          {/* Groups List */}
          <div className="groups-list">
            {getFilteredGroups().length === 0 ? (
              <div className="no-groups">
                {groups.length === 0 ? (
                  <p>No groups found. Create your first group from the Contacts tab!</p>
                ) : (
                  <p>No groups match your search.</p>
                )}
              </div>
            ) : (
              <div className="groups-grid">
                {getFilteredGroups().map(group => (
                  <div 
                    key={group.id} 
                    className={`group-card ${selectedGroup?.id === group.id ? 'selected' : ''}`}
                    onClick={() => setSelectedGroup(selectedGroup?.id === group.id ? null : group)}
                  >
                    <div className="group-info">
                      <h4>👥 {group.groupName}</h4>
                      <p className="member-count">{group.memberCount} members</p>
                      <p className="group-id">ID: {group.groupId}</p>
                      <p className="created-date">
                        Created: {new Date(group.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedGroup?.id === group.id && (
                      <div className="group-selected-indicator">
                        ✅ Selected for messaging
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Tab */}
      {activeTab === 'content' && (
        <div className="whatsapp-section">
          <div className="section-header">
            <h2>📚 Content Selection</h2>
            <div className="content-type-selector">
              <select 
                value={contentType} 
                onChange={(e) => setContentType(e.target.value as ContentType)}
                className="content-type-select"
              >
                <option value="martyrs">🕊️ Martyrs</option>
                <option value="news">📰 News</option>
                <option value="activities">🎯 Activities</option>
                <option value="locations">📍 Locations</option>
                <option value="legends">⭐ Legends</option>
              </select>
            </div>
          </div>

          {/* Search Content */}
          <div className="content-controls">
            <div className="search-box">
              <input
                type="text"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                placeholder={`🔍 Search ${contentType}...`}
                className="search-input"
              />
            </div>
            <div className="selection-info">
              {selectedContent.length > 0 && (
                <span className="selected-count">
                  {selectedContent.length} selected
                </span>
              )}
            </div>
          </div>

          {/* Content Actions */}
          {!loadingContent && contentItems.length > 0 && (
            <div className="content-actions">
              <button className="select-all-btn" onClick={selectAllContent}>
                ✅ Select All
              </button>
              <button className="clear-selection-btn" onClick={() => setSelectedContent([])}>
                ❌ Clear Selection
              </button>
            </div>
          )}

          {/* Content List */}
          <div className="content-list">
            {loadingContent ? (
              <div className="loading-content">
                <p>⏳ Loading {contentType}...</p>
              </div>
            ) : getFilteredContent().length === 0 ? (
              <div className="no-content">
                {contentItems.length === 0 ? (
                  <p>No {contentType} found.</p>
                ) : (
                  <p>No {contentType} match your search.</p>
                )}
              </div>
            ) : (
              <div className="content-grid">
                {getFilteredContent().map(item => (
                  <div 
                    key={item.id} 
                    className={`content-card ${selectedContent.some(c => c.id === item.id) ? 'selected' : ''}`}
                    onClick={() => toggleContentSelection(item)}
                  >
                    <div className="content-info">
                      <h4>{item.nameEn}</h4>
                      <p className="content-name-ar">{item.nameAr}</p>
                      <p className="content-type">{item.type}</p>
                      <div className="content-preview">
                        {formatContentMessage(item).substring(0, 150)}...
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messaging Tab */}
      {activeTab === 'messaging' && Array.isArray(sessions) && sessions.some(s => s.status === 'connected') && (
        <div className="whatsapp-section">
          <div className="section-header">
            <h2>💬 Send Messages</h2>
          </div>

          {/* Content Messaging */}
          {selectedContent.length > 0 && (
            <div className="messaging-section">
              <h3>📚 Send Selected Content ({selectedContent.length} items)</h3>
              
              <div className="selected-content-preview">
                <h4>📋 Selected Content:</h4>
                <div className="selected-content-list">
                  {selectedContent.map(item => (
                    <span key={item.id} className="content-tag">
                      {item.nameEn}
                      <button 
                        onClick={() => toggleContentSelection(item)}
                        className="remove-content"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="content-send-options">
                <button 
                  className="send-content-contacts-btn"
                  onClick={() => sendContentMessages(false)}
                  disabled={!selectedContacts.length || loading === 'sending-content' || sendCooldown > 0}
                >
                  {loading === 'sending-content' ? '⏳ Sending to Contacts...' : 
                   sendCooldown > 0 ? `⏱️ Wait ${sendCooldown}s` :
                   `📤 Send to ${selectedContacts.length} Contact(s)`}
                </button>

                <button 
                  className="send-content-group-btn"
                  onClick={() => sendContentMessages(true)}
                  disabled={!selectedGroup || loading === 'sending-group-content' || sendCooldown > 0}
                >
                  {loading === 'sending-group-content' ? '⏳ Sending to Group...' : 
                   sendCooldown > 0 ? `⏱️ Wait ${sendCooldown}s` :
                   selectedGroup ? `📤 Send to Group "${selectedGroup.groupName}"` : '📤 Select Group First'}
                </button>
              </div>
            </div>
          )}

          {/* Individual Contacts Messaging */}
          <div className="messaging-section">
            <h3>📱 Send Custom Message to Contacts</h3>
            <p>Selected: {selectedContacts.length} contact(s)</p>

            {selectedContacts.length === 0 ? (
              <div className="no-selection">
                <p>👥 Go to the Contacts tab and select recipients first</p>
                <button 
                  className="go-contacts-btn"
                  onClick={() => setActiveTab('contacts')}
                >
                  📋 Select Contacts
                </button>
              </div>
            ) : (
              <>
                {/* Selected Contacts Preview */}
                <div className="selected-contacts-preview">
                  <h4>📋 Recipients ({selectedContacts.length}):</h4>
                  <div className="recipients-list">
                    {selectedContacts.map(contact => (
                      <span key={contact.id} className="recipient-tag">
                        {contact.name}
                        <button 
                          onClick={() => toggleContactSelection(contact)}
                          className="remove-recipient"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Message Form */}
                <div className="form-group">
                  <label>Message:</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Enter your message here..."
                    rows={4}
                    className="message-input"
                  />
                  <small>Characters: {message.length}</small>
                </div>

                <div className="action-buttons">
                  <button 
                    className="send-btn"
                    onClick={sendBulkMessage}
                    disabled={loading === 'sending' || !message.trim() || sendCooldown > 0}
                  >
                    {loading === 'sending' ? '⏳ Sending...' : 
                     sendCooldown > 0 ? `⏱️ Wait ${sendCooldown}s` :
                     `📤 Send to ${selectedContacts.length} Contact(s)`}
                  </button>

                  <div className="group-section">
                    <input
                      type="text"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                      placeholder="Group name..."
                      className="group-name-input"
                    />
                    <button 
                      className="create-group-btn"
                      onClick={createGroup}
                      disabled={loading === 'creating-group' || !groupName.trim()}
                    >
                      {loading === 'creating-group' ? '⏳ Creating...' : `👥 Create Group (${selectedContacts.length})`}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Group Messaging */}
          <div className="messaging-section">
            <h3>👥 Send Custom Message to Group</h3>
            
            {!selectedGroup ? (
              <div className="no-selection">
                <p>👥 Go to the Groups tab and select a group first</p>
                <button 
                  className="go-groups-btn"
                  onClick={() => setActiveTab('groups')}
                >
                  👥 Select Group
                </button>
              </div>
            ) : (
              <>
                {/* Selected Group Preview */}
                <div className="selected-group-preview">
                  <h4>👥 Selected Group:</h4>
                  <div className="group-info">
                    <span className="group-name">{selectedGroup.groupName}</span>
                    <span className="group-members">({selectedGroup.memberCount} members)</span>
                    <button 
                      onClick={() => setSelectedGroup(null)}
                      className="remove-group"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Group Message Form */}
                <div className="form-group">
                  <label>Group Message:</label>
                  <textarea
                    value={groupMessage}
                    onChange={(e) => setGroupMessage(e.target.value)}
                    placeholder="Enter your group message here..."
                    rows={4}
                    className="message-input"
                  />
                  <small>Characters: {groupMessage.length}</small>
                </div>

                <button 
                  className="send-group-btn"
                  onClick={sendGroupMessage}
                  disabled={loading === 'sending-group' || !groupMessage.trim() || sendCooldown > 0}
                >
                  {loading === 'sending-group' ? '⏳ Sending to Group...' : 
                   sendCooldown > 0 ? `⏱️ Wait ${sendCooldown}s` :
                   `📤 Send to Group "${selectedGroup.groupName}"`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Show message if no connected sessions for messaging tab */}
      {activeTab === 'messaging' && (!Array.isArray(sessions) || !sessions.some(s => s.status === 'connected')) && (
        <div className="whatsapp-section">
          <div className="no-connection-message">
            <h3>📱 No WhatsApp Connection</h3>
            <p>Please connect to WhatsApp first to send messages.</p>
            <button 
              className="go-connection-btn"
              onClick={() => setActiveTab('connection')}
            >
              📱 Go to Connection
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsApp;
