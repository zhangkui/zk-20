import { createSignal, createEffect, onCleanup } from 'solid-js';
import L from 'leaflet';

const LocationPickerModal = (props) => {
  const [searchQuery, setSearchQuery] = createSignal('');
  const [searching, setSearching] = createSignal(false);
  const [searchResults, setSearchResults] = createSignal([]);
  const [selectedLat, setSelectedLat] = createSignal(props.initialLat || 39.9163);
  const [selectedLng, setSelectedLng] = createSignal(props.initialLng || 116.3972);
  const [selectedAddress, setSelectedAddress] = createSignal(props.initialAddress || '');
  let mapContainer = null;
  let mapInstance = null;
  let markerInstance = null;

  const updateMarker = (lat, lng) => {
    if (markerInstance) {
      markerInstance.setLatLng([lat, lng]);
    } else {
      markerInstance = L.marker([lat, lng], { draggable: true }).addTo(mapInstance);
      markerInstance.on('dragend', (e) => {
        const pos = e.target.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        reverseGeocode(pos.lat, pos.lng);
      });
    }
    mapInstance.panTo([lat, lng]);
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=zh-CN`,
        { headers: { 'User-Agent': 'ZK-20-App' } }
      );
      const data = await response.json();
      if (data.display_name) {
        setSelectedAddress(data.display_name);
      }
    } catch (e) {
      console.error('Reverse geocode error:', e);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery().trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery())}&limit=5&accept-language=zh-CN&countrycodes=cn`,
        { headers: { 'User-Agent': 'ZK-20-App' } }
      );
      const data = await response.json();
      setSearchResults(data);
    } catch (e) {
      console.error('Search error:', e);
      alert('地址搜索失败，请检查网络');
    } finally {
      setSearching(false);
    }
  };

  const selectResult = (result) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSelectedLat(lat);
    setSelectedLng(lng);
    setSelectedAddress(result.display_name);
    updateMarker(lat, lng);
    setSearchResults([]);
  };

  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    setSelectedLat(lat);
    setSelectedLng(lng);
    updateMarker(lat, lng);
    reverseGeocode(lat, lng);
  };

  const handleConfirm = () => {
    props.onConfirm({
      address: selectedAddress(),
      latitude: selectedLat(),
      longitude: selectedLng(),
    });
  };

  createEffect(() => {
    if (props.show && mapContainer && !mapInstance) {
      mapInstance = L.map(mapContainer).setView([selectedLat(), selectedLng()], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapInstance);
      mapInstance.on('click', handleMapClick);
      updateMarker(selectedLat(), selectedLng());
      if (props.initialLat && props.initialLng) {
        reverseGeocode(props.initialLat, props.initialLng);
      }
    } else if (props.show && mapInstance) {
      setTimeout(() => mapInstance.invalidateSize(), 100);
    }
  });

  createEffect(() => {
    if (!props.show) {
      if (mapInstance) {
        mapInstance.remove();
        mapInstance = null;
        markerInstance = null;
      }
      setSearchResults([]);
      setSearchQuery('');
      setSelectedLat(props.initialLat || 39.9163);
      setSelectedLng(props.initialLng || 116.3972);
      setSelectedAddress(props.initialAddress || '');
    }
  });

  onCleanup(() => {
    if (mapInstance) {
      mapInstance.remove();
    }
  });

  if (!props.show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={props.onClose}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '500px',
          maxHeight: '85vh',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--border-radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: 'var(--spacing-md)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', fontWeight: '600' }}>
            选择位置
          </h3>
          <button
            onClick={props.onClose}
            class="btn btn-sm"
            style={{ border: 'none', background: 'transparent', fontSize: '20px', padding: 0 }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
            <input
              class="form-input"
              type="text"
              placeholder="搜索地址..."
              value={searchQuery()}
              onInput={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ flex: 1, margin: 0 }}
            />
            <button
              class="btn btn-primary"
              onClick={handleSearch}
              disabled={searching()}
              style={{ whiteSpace: 'nowrap' }}
            >
              {searching() ? '搜索中...' : '搜索'}
            </button>
          </div>

          {searchResults().length > 0 && (
            <div
              style={{
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--border-radius-sm)',
                marginBottom: 'var(--spacing-sm)',
                maxHeight: '120px',
                overflowY: 'auto',
              }}
            >
              {searchResults().map((result, idx) => (
                <div
                  key={idx}
                  onClick={() => selectResult(result)}
                  style={{
                    padding: 'var(--spacing-sm) var(--spacing-md)',
                    cursor: 'pointer',
                    borderBottom: idx < searchResults().length - 1 ? '1px solid var(--color-border)' : 'none',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                  {result.display_name}
                </div>
              ))}
            </div>
          )}

          <div
            ref={(el) => (mapContainer = el)}
            style={{
              height: '300px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--color-border)',
              marginBottom: 'var(--spacing-sm)',
            }}
          />

          <div
            style={{
              padding: 'var(--spacing-sm)',
              background: 'var(--color-bg)',
              borderRadius: 'var(--border-radius-sm)',
              fontSize: 'var(--font-size-sm)',
            }}
          >
            <div class="mb-sm">
              <span class="text-secondary">地址：</span>
              <span>{selectedAddress() || '-'}</span>
            </div>
            <div class="grid grid-2">
              <div>
                <span class="text-secondary">纬度：</span>
                <span class="text-primary">{selectedLat().toFixed(6)}</span>
              </div>
              <div>
                <span class="text-secondary">经度：</span>
                <span class="text-primary">{selectedLng().toFixed(6)}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 'var(--spacing-md)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--spacing-sm)',
          }}
        >
          <button class="btn" onClick={props.onClose}>
            取消
          </button>
          <button class="btn btn-primary" onClick={handleConfirm}>
            确认选择
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPickerModal;
