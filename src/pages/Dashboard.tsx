import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { statisticsService, type StatisticsData, type FilterOptions } from '../services/statisticsService';
import { activityTypesService, type ActivityType } from '../services/activityTypesService';
import { useAuth } from '../context/AuthContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

const Dashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { hasPermission, canAccessActivityType } = useAuth();

  const [filters, setFilters] = useState<FilterOptions>({
    dateRange: 'month'
  });

  useEffect(() => {
    loadData();
    loadActivityTypes();
  }, [filters]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await statisticsService.getStatistics(filters);
      setStatistics(data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const loadActivityTypes = async () => {
    try {
      const types = await activityTypesService.getAllActivityTypes();
      const allowedTypes = types.filter(type => canAccessActivityType(type.id!));
      setActivityTypes(allowedTypes);
    } catch (error) {
      console.error('Error loading activity types:', error);
    }
  };

  const handleFilterChange = (key: keyof FilterOptions, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleDateRangeChange = (range: 'week' | 'month' | 'year' | 'all' | 'custom') => {
    if (range === 'custom') {
      // Keep current custom dates
      setFilters(prev => ({ ...prev, dateRange: 'month' }));
    } else {
      setFilters(prev => ({ 
        ...prev, 
        dateRange: range,
        startDate: undefined,
        endDate: undefined
      }));
    }
  };

  const getStatCards = () => {
    if (!statistics) return [];

    const cards = [
      { title: 'Total Martyrs', value: statistics.totalMartyrs, icon: '👥', color: '#ef4444', permission: 'martyrs' },
      { title: 'Total Activities', value: statistics.totalActivities, icon: '📅', color: '#3b82f6', permission: 'activities' },
      { title: 'Total News', value: statistics.totalNews, icon: '📰', color: '#10b981', permission: 'news' },
      { title: 'Live News', value: statistics.totalLiveNews, icon: '🔴', color: '#f59e0b', permission: 'liveNews' },
      { title: 'Total Locations', value: statistics.totalLocations, icon: '📍', color: '#8b5cf6', permission: 'locations' },
      { title: 'Total Legends', value: statistics.totalLegends, icon: '📜', color: '#ec4899', permission: 'legends' },
      { title: 'Activity Types', value: statistics.totalActivityTypes, icon: '🏷️', color: '#06b6d4', permission: 'activityTypes' },
      { title: 'Total Admins', value: statistics.totalAdmins, icon: '👤', color: '#84cc16', permission: 'admins' },
    ];

    return cards.filter(card => hasPermission(card.permission));
  };

  const getLineChartData = () => {
    if (!statistics) return null;

    const datasets = [];

    if (hasPermission('martyrs') && statistics.martyrsOverTime.length > 0) {
      datasets.push({
        label: 'Martyrs',
        data: statistics.martyrsOverTime.map(item => item.count),
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
      });
    }

    if (hasPermission('activities') && statistics.activitiesOverTime.length > 0) {
      datasets.push({
        label: 'Activities',
        data: statistics.activitiesOverTime.map(item => item.count),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4,
      });
    }

    if (hasPermission('news') && statistics.newsOverTime.length > 0) {
      datasets.push({
        label: 'News',
        data: statistics.newsOverTime.map(item => item.count),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
      });
    }

    return {
      labels: statistics.martyrsOverTime.map(item => 
        new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets
    };
  };

  const getActivitiesBarChartData = () => {
    if (!statistics || !hasPermission('activities')) return null;

    return {
      labels: statistics.activitiesByType.map(item => item.name),
      datasets: [{
        label: 'Activities by Type',
        data: statistics.activitiesByType.map(item => item.count),
        backgroundColor: [
          '#ef4444', '#3b82f6', '#10b981', '#f59e0b', 
          '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
        ],
        borderWidth: 1,
      }]
    };
  };

  const getActivityStatusDoughnutData = () => {
    if (!statistics || !hasPermission('activities')) return null;

    return {
      labels: statistics.activitiesByStatus.map(item => item.name),
      datasets: [{
        data: statistics.activitiesByStatus.map(item => item.count),
        backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#6b7280'],
        borderWidth: 2,
      }]
    };
  };

  const getNewsTypeData = () => {
    if (!statistics || !hasPermission('news')) return null;

    return {
      labels: statistics.newsByType.map(item => item.name),
      datasets: [{
        data: statistics.newsByType.map(item => item.count),
        backgroundColor: ['#3b82f6', '#ef4444'],
        borderWidth: 2,
      }]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div className="page-title-section">
          <h1 className="page-title">📊 Admin Dashboard</h1>
          <p className="page-subtitle">Overview of your admin panel statistics</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Filters */}
      <div className="dashboard-filters">
        <div className="filter-group">
          <label>📅 Time Range</label>
          <select 
            value={filters.dateRange} 
            onChange={(e) => handleDateRangeChange(e.target.value as any)}
          >
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
            <option value="year">Last Year</option>
            <option value="all">All Time</option>
          </select>
        </div>

        {hasPermission('activities') && (
          <div className="filter-group">
            <label>🏷️ Activity Type</label>
            <select 
              value={filters.activityType || ''} 
              onChange={(e) => handleFilterChange('activityType', e.target.value || undefined)}
            >
              <option value="">All Activity Types</option>
              {activityTypes.map(type => (
                <option key={type.id} value={type.id}>{type.nameEn}</option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group date-range">
          <label>📆 Custom Date Range</label>
          <div className="date-inputs">
            <input
              type="date"
              placeholder="Start Date"
              value={filters.startDate ? filters.startDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFilterChange('startDate', e.target.value ? new Date(e.target.value) : undefined)}
            />
            <input
              type="date"
              placeholder="End Date"
              value={filters.endDate ? filters.endDate.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFilterChange('endDate', e.target.value ? new Date(e.target.value) : undefined)}
            />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        {getStatCards().map((card, index) => (
          <div key={index} className="stat-card" style={{ borderLeftColor: card.color }}>
            <div className="stat-icon" style={{ backgroundColor: card.color }}>
              {card.icon}
            </div>
            <div className="stat-content">
              <h3 className="stat-value">{card.value.toLocaleString()}</h3>
              <p className="stat-title">{card.title}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Line Chart */}
        {getLineChartData() && (
          <div className="chart-container">
            <h3 className="chart-title">Trends Over Time</h3>
            <div className="chart-wrapper">
              <Line data={getLineChartData()!} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Activities by Type Bar Chart */}
        {getActivitiesBarChartData() && (
          <div className="chart-container">
            <h3 className="chart-title">Activities by Type</h3>
            <div className="chart-wrapper">
              <Bar data={getActivitiesBarChartData()!} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Activity Status Doughnut */}
        {getActivityStatusDoughnutData() && (
          <div className="chart-container">
            <h3 className="chart-title">Activity Status Distribution</h3>
            <div className="chart-wrapper">
              <Doughnut data={getActivityStatusDoughnutData()!} options={doughnutOptions} />
            </div>
          </div>
        )}

        {/* News Type Doughnut */}
        {getNewsTypeData() && (
          <div className="chart-container">
            <h3 className="chart-title">News Type Distribution</h3>
            <div className="chart-wrapper">
              <Doughnut data={getNewsTypeData()!} options={doughnutOptions} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
