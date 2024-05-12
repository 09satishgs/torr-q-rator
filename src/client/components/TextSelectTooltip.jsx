import React, { useState, useEffect } from 'react';

export default function TextSelectTooltip({ onSaveText }) {
  const [tooltipPos, setTooltipPos] = useState(null);
  const [selectedText, setSelectedText] = useState('');

  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setTooltipPos(null);
        setSelectedText('');
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 2 && text.length < 100) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelectedText(text);
        setTooltipPos({
          top: window.scrollY + rect.top - 42,
          left: window.scrollX + rect.left + rect.width / 2,
        });
      } else {
        setTooltipPos(null);
        setSelectedText('');
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  if (!tooltipPos || !selectedText) return null;

  const handleSave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onSaveText(selectedText);
    setTooltipPos(null);
    setSelectedText('');
    window.getSelection().removeAllRanges();
  };

  return (
    <div
      className="text-select-tooltip"
      style={{
        position: 'absolute',
        top: `${tooltipPos.top}px`,
        left: `${tooltipPos.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 2000,
      }}
    >
      <button type="button" className="btn-tooltip-save" onClick={handleSave}>
        <i className="fa-solid fa-bookmark"></i>
        <span>Save "{selectedText.slice(0, 20)}..." to Wishlist</span>
      </button>
    </div>
  );
}
