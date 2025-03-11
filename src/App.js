import React, { useState } from 'react';
import Header from './components/Header';
import Menu from './components/Menu';
import Projects from './components/Projects';
import Experience from './components/Experience';
import Home from './components/Home'; 
import Contact from './components/Contact'; 
import './App.css';

function App() {
  const [showProjects, setShowProjects] = useState(false);
  const [showExperience, setShowExperience] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const [showHome, setShowHome] = useState(false);
  const [showContact, setShowContact] = useState(false);


  const handleMenuClick = (section) => {
    if (section === 'home') {
      setShowHome(true);
      setShowProjects(false);
      setShowExperience(false);
      setShowContact(false);
    } else if (section === 'projects') {
      setShowProjects(true);
      setShowExperience(false);
      setShowHome(false);
      setShowContact(false);
    } else if (section === 'experience') {
      setShowExperience(true);
      setShowProjects(false);
      setShowHome(false);
      setShowContact(false);
    } else if (section === 'contact') {
      setShowContact(true);
      setShowHome(false);
      setShowProjects(false);
      setShowExperience(false);
    } else {
      setShowHome(false);
      setShowProjects(false);
      setShowExperience(false);
      setShowContact(false);
    }
    setActiveSection(section);
  };

  return (
    <div className="App">
      <Header />
      <div className="container">
        <div className="row">
          <div className="columnl">
            <Menu onMenuClick={handleMenuClick} activeSection={activeSection} />
          </div>
          <div className="columnr">
            {showHome && <Home />}
            {showProjects && <Projects />}
            {showExperience && <Experience />}
            {showContact && <Contact />}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;