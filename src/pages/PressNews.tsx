import React from 'react';
import NewsPage from './News';

const PressNews: React.FC = () => {
  return <NewsPage isPressNewsOnly={true} />;
};

export default PressNews;
