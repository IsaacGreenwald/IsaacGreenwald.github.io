import React from 'react';
import { motion } from 'framer-motion';


const Home = () => {
  return (
    <motion.div
      className="projects"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
    <div className="home">
      
      <p className="home-text">
        I am a senior at Colorado College studying computer science and statistics. For my senior thesis, I created an analytical dashboard for 
        the Colorado College AI Taskforce showing how students are using AI in CC classes. Additionally, I completed a ten week REU at Montana State University
        investigating the capabilities of the packet sniffing system Snort. I am currently looking for work in artificial intelligence, cybersecurity, 
        machine learning and data science. In my free time, I love rock climbing, photography, spending time in the darkroom, and skiing. 
      </p>
    </div>
    </motion.div>
  );
};

export default Home;