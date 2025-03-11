import React from 'react';
import { motion } from 'framer-motion';

const Projects = () => {
  return (
    <motion.div
      className="projects"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <div className="project-list">
        <a className="link" href="https://github.com/Skingr/tigerone" target="_blank" rel="noopener noreferrer">
          <div className="project-item">
            <span className="proj">Colorado College AI Taskforce Website</span>
            <span className="desc">Senior Year thesis project which anonymously logs student LLM queries and provides class-specific analytics for professors. 
              Primarily coded using ReactJS.</span>
          </div>
        </a>
        <a className="link" href="https://github.com/igreenwald28/igreenwald28.github.io" target="_blank" rel="noopener noreferrer">
          <div className="project-item">
            <span className="proj">Photography Portfolio</span>
            <span className="desc"> My personal photography portfolio containing pictures taken and edited by me. Coded using HTML, CSS, and JavaScript as a personal project. </span>
          </div>
        </a>
        <a className="link" href="https://github.com/IsaacGreenwald/monopoloygame" target="_blank" rel="noopener noreferrer">
          <div className="project-item">
            <span className="proj">Monopoly Game</span>
            <span className="desc">A monopoly game with player and AI strategies, developed for a Software Design class. Full GUI is implemented with Java codebase.  </span>
          </div>
        </a>
        <a className="link" href="https://github.com/IsaacGreenwald/nlplab6" target="_blank" rel="noopener noreferrer">
          <div className="project-item">
            <span className="proj">Hidden Markov Model Tagger</span>
            <span className="desc">A Project done for Natural Language Processing. Tags words with parts of speech and evaluates performance 
              using expected output files. Coded in Python. </span>
          </div>
        </a>
        <a className="link" href="https://github.com/IsaacGreenwald/monopoloygame" target="_blank" rel="noopener noreferrer">
          <div className="project-item">
            <span className="proj">Comparing TSP Algorithms</span>
            <span className="desc">Class project for Data Structures and Algorithms. A comparison of Hungarian, Nearest Neighbor, and
               Brute Force algorithms for the Travelling Salesperson Problem.</span>
          </div>
        </a>
      </div>
    </motion.div>
  );
};

export default Projects;
