import React from 'react';
import NewsPage from './News';

const LiveNews: React.FC = () => {
  return <NewsPage defaultType="live" isLiveNewsOnly={true} />;
};

export default LiveNews;