import React from 'react';

const Menu = ({ onMenuClick, activeSection }) => {
  return (
    <div className="menu">
      <button
        onClick={() => onMenuClick('home')}
        className={`menu-item ${activeSection === 'home' ? 'active' : ''}`}
      >
        HOME
      </button>
      <button
        onClick={() => onMenuClick('projects')}
        className={`menu-item ${activeSection === 'projects' ? 'active' : ''}`}
      >
        PROJECTS
      </button>
      <button
        onClick={() => onMenuClick('experience')}
        className={`menu-item ${activeSection === 'experience' ? 'active' : ''}`}
      >
        EXPERIENCE
      </button>
      <button
        onClick={() => onMenuClick('contact')}
        className={`menu-item ${activeSection === 'contact' ? 'active' : ''}`}
      >
        CONTACT
      </button>
    </div>
  );
};

export default Menu;