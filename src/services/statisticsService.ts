import { 
  collection, 
  getDocs, 
  query,
  where,
  orderBy,
  Timestamp,
  getCountFromServer
} from 'firebase/firestore';
import { db } from '../firebase';
import { startOfDay, endOfDay, subDays, format } from 'date-fns';

export interface StatisticsData {
  totalMartyrs: number;
  totalActivities: number;
  totalNews: number;
  totalLiveNews: number;
  totalLocations: number;
  totalLegends: number;
  totalActivityTypes: number;
  totalAdmins: number;
  
  // Time-based data for charts
  martyrsOverTime: { date: string; count: number }[];
  activitiesOverTime: { date: string; count: number }[];
  newsOverTime: { date: string; count: number }[];
  activitiesByType: { name: string; count: number }[];
  activitiesByStatus: { name: string; count: number }[];
  newsByType: { name: string; count: number }[];
}

export interface FilterOptions {
  dateRange: 'week' | 'month' | 'year' | 'all';
  startDate?: Date;
  endDate?: Date;
  activityType?: string;
}

export const statisticsService = {
  async getStatistics(filters: FilterOptions = { dateRange: 'month' }): Promise<StatisticsData> {
    try {
      const { startDate, endDate } = getDateRange(filters.dateRange, filters.startDate, filters.endDate);
      
      // Get total counts
      const [
        martyrsCount,
        activitiesCount,
        newsCount,
        liveNewsCount,
        locationsCount,
        legendsCount,
        activityTypesCount,
        adminsCount
      ] = await Promise.all([
        getCollectionCount('martyrs'),
        getCollectionCount('activities'),
        getCollectionCount('news'),
        getCollectionCount('news', [where('type', '==', 'live')]),
        getCollectionCount('locations'),
        getCollectionCount('legends'),
        getCollectionCount('activityTypes'),
        getCollectionCount('users', [where('role', 'in', ['main', 'secondary'])])
      ]);

      // Get time-based data
      const [
        martyrsOverTime,
        activitiesOverTime,
        newsOverTime,
        activitiesByType,
        activitiesByStatus,
        newsByType
      ] = await Promise.all([
        getTimeBasedData('martyrs', 'createdAt', startDate, endDate),
        getTimeBasedData('activities', 'createdAt', startDate, endDate),
        getTimeBasedData('news', 'createdAt', startDate, endDate),
        getActivitiesByType(filters.activityType),
        getActivitiesByStatus(),
        getNewsByType()
      ]);

      return {
        totalMartyrs: martyrsCount,
        totalActivities: activitiesCount,
        totalNews: newsCount,
        totalLiveNews: liveNewsCount,
        totalLocations: locationsCount,
        totalLegends: legendsCount,
        totalActivityTypes: activityTypesCount,
        totalAdmins: adminsCount,
        martyrsOverTime,
        activitiesOverTime,
        newsOverTime,
        activitiesByType,
        activitiesByStatus,
        newsByType
      };
    } catch (error) {
      console.error('Error fetching statistics:', error);
      throw error;
    }
  }
};

// Helper functions
function getDateRange(range: string, customStart?: Date, customEnd?: Date) {
  const now = new Date();
  let startDate: Date;
  let endDate: Date = endOfDay(now);

  if (customStart && customEnd) {
    startDate = startOfDay(customStart);
    endDate = endOfDay(customEnd);
  } else {
    switch (range) {
      case 'week':
        startDate = startOfDay(subDays(now, 7));
        break;
      case 'month':
        startDate = startOfDay(subDays(now, 30));
        break;
      case 'year':
        startDate = startOfDay(subDays(now, 365));
        break;
      default:
        startDate = new Date(2020, 0, 1); // Far back date for 'all'
    }
  }

  return { startDate, endDate };
}

async function getCollectionCount(collectionName: string, constraints: any[] = []): Promise<number> {
  try {
    const q = constraints.length > 0 
      ? query(collection(db, collectionName), ...constraints)
      : collection(db, collectionName);
    
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (error) {
    console.error(`Error counting ${collectionName}:`, error);
    return 0;
  }
}

async function getTimeBasedData(
  collectionName: string, 
  dateField: string, 
  startDate: Date, 
  endDate: Date
): Promise<{ date: string; count: number }[]> {
  try {
    const q = query(
      collection(db, collectionName),
      where(dateField, '>=', Timestamp.fromDate(startDate)),
      where(dateField, '<=', Timestamp.fromDate(endDate)),
      orderBy(dateField)
    );
    
    const snapshot = await getDocs(q);
    const dataByDate: { [key: string]: number } = {};
    
    snapshot.docs.forEach(doc => {
      const date = doc.data()[dateField]?.toDate();
      if (date) {
        const dateKey = format(date, 'yyyy-MM-dd');
        dataByDate[dateKey] = (dataByDate[dateKey] || 0) + 1;
      }
    });
    
    // Fill in missing dates with 0
    const result: { date: string; count: number }[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateKey = format(currentDate, 'yyyy-MM-dd');
      result.push({
        date: dateKey,
        count: dataByDate[dateKey] || 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  } catch (error) {
    console.error(`Error fetching time-based data for ${collectionName}:`, error);
    return [];
  }
}

async function getActivitiesByType(filterType?: string): Promise<{ name: string; count: number }[]> {
  try {
    const [activitiesSnapshot, activityTypesSnapshot] = await Promise.all([
      getDocs(collection(db, 'activities')),
      getDocs(collection(db, 'activityTypes'))
    ]);
    
    const activityTypes = new Map();
    activityTypesSnapshot.docs.forEach(doc => {
      activityTypes.set(doc.id, doc.data().nameEn);
    });
    
    const countByType: { [key: string]: number } = {};
    
    activitiesSnapshot.docs.forEach(doc => {
      const activityTypeId = doc.data().activityTypeId;
      if (!filterType || activityTypeId === filterType) {
        const typeName = activityTypes.get(activityTypeId) || 'Unknown';
        countByType[typeName] = (countByType[typeName] || 0) + 1;
      }
    });
    
    return Object.entries(countByType).map(([name, count]) => ({ name, count }));
  } catch (error) {
    console.error('Error fetching activities by type:', error);
    return [];
  }
}

async function getActivitiesByStatus(): Promise<{ name: string; count: number }[]> {
  try {
    const snapshot = await getDocs(collection(db, 'activities'));
    const statusCount = { active: 0, inactive: 0, upcoming: 0, expired: 0 };
    const now = new Date();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const activityDate = data.date?.toDate();
      const durationHours = data.durationHours || 24;
      
      if (activityDate) {
        const [hours, minutes] = (data.time || '00:00').split(':');
        activityDate.setHours(parseInt(hours), parseInt(minutes));
        const endTime = new Date(activityDate);
        endTime.setHours(endTime.getHours() + durationHours);
        
        if (data.isActive) {
          if (now >= endTime) {
            statusCount.expired++;
          } else {
            statusCount.active++;
          }
        } else {
          if (now < activityDate) {
            statusCount.upcoming++;
          } else {
            statusCount.inactive++;
          }
        }
      }
    });
    
    return Object.entries(statusCount).map(([name, count]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1), 
      count 
    }));
  } catch (error) {
    console.error('Error fetching activities by status:', error);
    return [];
  }
}

async function getNewsByType(): Promise<{ name: string; count: number }[]> {
  try {
    const snapshot = await getDocs(collection(db, 'news'));
    const typeCount = { regular: 0, live: 0 };
    
    snapshot.docs.forEach(doc => {
      const type = doc.data().type || 'regular';
      typeCount[type as keyof typeof typeCount]++;
    });
    
    return Object.entries(typeCount).map(([name, count]) => ({ 
      name: name.charAt(0).toUpperCase() + name.slice(1), 
      count 
    }));
  } catch (error) {
    console.error('Error fetching news by type:', error);
    return [];
  }
} 