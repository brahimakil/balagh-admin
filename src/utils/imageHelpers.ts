import { DEFAULT_IMAGES } from './constants';

export const getNewsMainImage = (newsItem: { mainImage?: string }): string => {
  // If mainImage exists and is not empty, use it; otherwise use default
  return newsItem.mainImage && newsItem.mainImage.trim() !== '' 
    ? newsItem.mainImage 
    : DEFAULT_IMAGES.NEWS;
};

export const getImageWithFallback = (imageUrl?: string, fallbackType: keyof typeof DEFAULT_IMAGES = 'NEWS'): string => {
  return imageUrl && imageUrl.trim() !== '' 
    ? imageUrl 
    : DEFAULT_IMAGES[fallbackType];
};
