import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Globe } from 'lucide-react';
import { getAllTimezones, getTzLabel } from '../../utils/timezone';
import './TimezoneSelect.css';

export default function TimezoneSelect({ value, onChange, placeholder = 'Select timezone...' }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef(null);
  const inputRef = useRef(null);

  const allZones = useMemo(() => getAllTimezones(), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return allZones;
    return allZones.filter(z =>
      z.value.toLowerCase().includes(q) ||
      z.label.toLowerCase().includes(q) ||
      z.city.toLowerCase().includes(q) ||
      z.offset.includes(q)
    );
  }, [allZones, query]);

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selectedZone = allZones.find(z => z.value === value);
  const displayLabel = selectedZone ? selectedZone.label : value ? getTzLabel(value) : '';

  function select(tz) {
    onChange(tz);
    setOpen(false);
    setQuery('');
  }

  // Group visible results by region for display
  const grouped = useMemo(() => {
    const map = {};
    for (const z of filtered.slice(0, 200)) {
      if (!map[z.region]) map[z.region] = [];
      map[z.region].push(z);
    }
    return map;
  }, [filtered]);

  return (
    <div className="tz-select" ref={wrapRef}>
      <button
        type="button"
        className={`tz-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <Globe size={14} className="tz-globe" />
        <span className="tz-trigger-label">{displayLabel || placeholder}</span>
        <ChevronDown size={14} className={`tz-chevron ${open ? 'rotated' : ''}`} />
      </button>

      {open && (
        <div className="tz-dropdown">
          <div className="tz-search-wrap">
            <Search size={13} />
            <input
              ref={inputRef}
              className="tz-search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search city, country or UTC offset..."
            />
          </div>
          <div className="tz-list">
            {Object.keys(grouped).length === 0 ? (
              <div className="tz-empty">No timezones found</div>
            ) : query ? (
              // Flat list when searching
              filtered.slice(0, 150).map(z => (
                <button
                  key={z.value}
                  type="button"
                  className={`tz-option ${z.value === value ? 'selected' : ''}`}
                  onClick={() => select(z.value)}
                >
                  <span className="tz-offset">{z.offset}</span>
                  <span className="tz-name">{z.value.replace(/_/g, ' ')}</span>
                </button>
              ))
            ) : (
              // Grouped by region when browsing
              Object.entries(grouped).map(([region, zones]) => (
                <div key={region}>
                  <div className="tz-group-header">{region}</div>
                  {zones.map(z => (
                    <button
                      key={z.value}
                      type="button"
                      className={`tz-option ${z.value === value ? 'selected' : ''}`}
                      onClick={() => select(z.value)}
                    >
                      <span className="tz-offset">UTC{z.offset}</span>
                      <span className="tz-name">{z.city || z.value.replace(/_/g, ' ')}</span>
                    </button>
                  ))}
                </div>
              ))
            )}
            {filtered.length > 200 && (
              <div className="tz-count-note">Showing 200 of {filtered.length} — search to narrow down</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
