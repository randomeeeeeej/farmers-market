import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import Papa from 'papaparse';
import {
  ArrowUpRight,
  Bus,
  ChevronRight,
  Clock3,
  CreditCard,
  LocateFixed,
  MapPin,
  Search,
  ShoppingBasket,
  Store,
  TrainFront,
  X,
} from 'lucide-react';
import csvUrl from '../data/Farmers_Markets.csv?url';

const PHILLY_CENTER = [39.9526, -75.1652];
const DAYS = ['sun', 'mon', 'tues', 'wed', 'thurs', 'fri', 'sat'];
const DAY_LABELS = { mon: 'Monday', tues: 'Tuesday', wed: 'Wednesday', thurs: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };

function webMercatorToLatLng(x, y) {
  const radius = 6378137;
  const longitude = (Number(x) / radius) * (180 / Math.PI);
  const latitude = (2 * Math.atan(Math.exp(Number(y) / radius)) - Math.PI / 2) * (180 / Math.PI);
  return [latitude, longitude];
}

function yes(value) {
  return String(value).trim().toLowerCase() === 'yes';
}

function humanTime(value) {
  if (!value) return '';
  const [hours, minutes = '00'] = value.split(':').map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function dayHours(market, day) {
  const start = market[`hours_${day}_start`];
  const end = market[`hours_${day}_end`];
  return start && end ? `${humanTime(start)}–${humanTime(end)}` : 'Closed';
}

function todayHours(market) {
  return dayHours(market, DAYS[new Date().getDay()]);
}

function isOpenToday(market) {
  return todayHours(market) !== 'Closed';
}

function markerIcon(selected = false) {
  return L.divIcon({
    className: 'market-marker-wrap',
    html: `<div class="market-marker ${selected ? 'is-selected' : ''}"><span>✦</span></div>`,
    iconSize: selected ? [46, 46] : [38, 38],
    iconAnchor: selected ? [23, 23] : [19, 19],
  });
}

function MapFocus({ market }) {
  const map = useMap();
  useEffect(() => {
    if (market) map.flyTo(market.position, 15, { duration: 0.8 });
  }, [market, map]);
  return null;
}

function MarketCard({ market, active, onSelect }) {
  return (
    <button className={`market-card ${active ? 'active' : ''}`} onClick={() => onSelect(market)}>
      <div className="market-card-top">
        <span className={`open-pill ${isOpenToday(market) ? '' : 'closed'}`}>
          {isOpenToday(market) ? 'Open today' : 'Closed today'}
        </span>
        <ChevronRight size={18} />
      </div>
      <h3>{market.name}</h3>
      <p><MapPin size={14} /> {market.address}</p>
      <div className="card-meta">
        <span><Clock3 size={14} /> {todayHours(market)}</span>
        <span>{market.zip}</span>
      </div>
    </button>
  );
}

function DetailsPanel({ market, onClose }) {
  const paymentMethods = [
    yes(market.payment_snap) && 'SNAP',
    yes(market.payment_fmnp) && 'FMNP',
    yes(market.payment_philly_food_bucks) && 'Food Bucks',
    yes(market.payment_credit) && 'Cards',
    yes(market.payment_cash) && 'Cash',
  ].filter(Boolean);
  const schedule = Object.keys(DAY_LABELS)
    .map((day) => ({ day, hours: dayHours(market, day), note: market[`hours_${day}_exceptions`] }))
    .filter(({ hours, note }) => hours !== 'Closed' || note);

  return (
    <aside className="details-panel">
      <button className="close-button" onClick={onClose} aria-label="Close market details"><X size={20} /></button>
      <div className="detail-hero">
        <span className="eyebrow">Philadelphia market</span>
        <h2>{market.name}</h2>
        <p><MapPin size={16} /> {market.address}, Philadelphia, PA {market.zip}</p>
      </div>

      <div className="detail-section quick-facts">
        <div><Clock3 /><span><small>Today</small>{todayHours(market)}</span></div>
        <div><ShoppingBasket /><span><small>Season</small>{yes(market.season_year_round) ? 'Year-round' : 'Seasonal'}</span></div>
      </div>

      {schedule.length > 0 && (
        <div className="detail-section schedule-section">
          <h3>Weekly schedule</h3>
          {schedule.map(({ day, hours, note }) => (
            <div className="schedule-row" key={day}>
              <strong>{DAY_LABELS[day]}</strong>
              <span>{hours}</span>
              {note && <small>{note}</small>}
            </div>
          ))}
        </div>
      )}

      {paymentMethods.length > 0 && (
        <div className="detail-section">
          <h3>Ways to pay</h3>
          <div className="payment-row">
            {paymentMethods.map((method) => <span key={method}>{method === 'Cards' && <CreditCard size={13} />}{method}</span>)}
          </div>
        </div>
      )}

      {(market.transit_bus || market.transit_subway || market.transit_regional_rail || market.transit_trolley) && (
        <div className="detail-section transit">
          <h3>Getting there</h3>
          {market.transit_bus && <p><Bus size={16} /> Bus {market.transit_bus}</p>}
          {market.transit_subway && <p><TrainFront size={16} /> Subway {market.transit_subway}</p>}
          {market.transit_trolley && <p><TrainFront size={16} /> Trolley {market.transit_trolley}</p>}
          {market.transit_regional_rail && <p><TrainFront size={16} /> Regional rail nearby</p>}
        </div>
      )}

      {market.operator && <div className="detail-section operator"><small>Operated by</small><strong>{market.operator}</strong></div>}

      {market.contact_website && (
        <a className="website-link" href={market.contact_website.startsWith('http') ? market.contact_website : `https://${market.contact_website}`} target="_blank" rel="noreferrer">
          Visit market website <ArrowUpRight size={16} />
        </a>
      )}
    </aside>
  );
}

export default function App() {
  const [markets, setMarkets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed = data
          .filter((row) => row.X && row.Y && row.name)
          .map((row) => ({ ...row, position: webMercatorToLatLng(row.X, row.Y) }));
        setMarkets(parsed);
        setLoading(false);
      },
    });
  }, []);

  const filteredMarkets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return markets.filter((market) => {
      const matchesSearch = !needle || `${market.name} ${market.address} ${market.zip}`.toLowerCase().includes(needle);
      const matchesFilter = filter === 'all'
        || (filter === 'open' && isOpenToday(market))
        || (filter === 'snap' && yes(market.payment_snap))
        || (filter === 'year' && yes(market.season_year_round));
      return matchesSearch && matchesFilter;
    });
  }, [markets, query, filter]);

  return (
    <main className="app-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top"><span><Store size={21} /></span><strong>Market Day</strong><small>PHILADELPHIA</small></a>
        <div className="header-copy"><span>Fresh food, closer than you think.</span><strong>{markets.length} neighborhood markets</strong></div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar-intro">
            <span className="eyebrow">Explore the city</span>
            <h1>Find your<br />market day.</h1>
            <p>Fresh produce, local makers, and community—mapped from Philadelphia's open data.</p>
          </div>
          <label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search market or neighborhood" /></label>
          <div className="filters">
            {[['all', 'All'], ['open', 'Open today'], ['snap', 'SNAP'], ['year', 'Year-round']].map(([value, label]) => (
              <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>
            ))}
          </div>
          <div className="results-label"><strong>{filteredMarkets.length} markets</strong><span>Philadelphia, PA</span></div>
          <div className="market-list">
            {loading && <p className="loading">Gathering market stalls…</p>}
            {filteredMarkets.map((market) => (
              <MarketCard key={market.objectid} market={market} active={selected?.objectid === market.objectid} onSelect={setSelected} />
            ))}
          </div>
        </aside>

        <div className="map-wrap">
          <MapContainer center={PHILLY_CENTER} zoom={12} zoomControl className="map">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filteredMarkets.map((market) => (
              <Marker key={market.objectid} position={market.position} icon={markerIcon(selected?.objectid === market.objectid)} eventHandlers={{ click: () => setSelected(market) }}>
                <Tooltip direction="top" offset={[0, -18]}><strong>{market.name}</strong><br />{todayHours(market)}</Tooltip>
              </Marker>
            ))}
            <MapFocus market={selected} />
          </MapContainer>
          <div className="map-note"><LocateFixed size={16} /><span>All locations are read directly from Farmers_Markets.csv</span></div>
        </div>

        {selected && <DetailsPanel market={selected} onClose={() => setSelected(null)} />}
      </section>
    </main>
  );
}
