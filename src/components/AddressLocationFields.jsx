import { useLocations } from '../hooks/useLocations'

export default function AddressLocationFields({
  title,
  street,
  province,
  city,
  barangay,
  onChange,
  disabled = false,
  streetPlaceholder = 'House no., street, sitio / purok',
}) {
  const locations = useLocations(province, city)

  function patch(next) {
    onChange(next)
  }

  return (
    <section className={`youth-address-block${disabled ? ' is-disabled' : ''}`}>
      {title ? <h3>{title}</h3> : null}
      <label className="field">
        <span>House / street / sitio (optional)</span>
        <input
          className="input"
          value={street}
          disabled={disabled}
          onChange={(event) => patch({ street: event.target.value, province, city, barangay })}
          placeholder={streetPlaceholder}
        />
      </label>
      <div className="field-row youth-address-location-row">
        <label className="field">
          <span>Province</span>
          <select
            className="input"
            value={province}
            disabled={disabled || locations.loadingProvinces}
            onChange={(event) => patch({ street, province: event.target.value, city: '', barangay: '' })}
          >
            <option value="">{locations.loadingProvinces ? 'Loading provinces…' : 'Select province'}</option>
            {locations.provinces.map((item) => (
              <option key={item.code} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Municipality / city</span>
          <select
            className="input"
            value={city}
            disabled={disabled || !province || locations.loadingCities}
            onChange={(event) => patch({ street, province, city: event.target.value, barangay: '' })}
          >
            <option value="">
              {!province
                ? 'Select a province first'
                : locations.loadingCities
                  ? 'Loading municipalities…'
                  : 'Select municipality / city'}
            </option>
            {locations.cities.map((item) => (
              <option key={item.code} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Barangay</span>
          <select
            className="input"
            value={barangay}
            disabled={disabled || !city || locations.loadingBarangays}
            onChange={(event) => patch({ street, province, city, barangay: event.target.value })}
          >
            <option value="">
              {!city
                ? 'Select a municipality first'
                : locations.loadingBarangays
                  ? 'Loading barangays…'
                  : 'Select barangay'}
            </option>
            {locations.barangays.map((item) => (
              <option key={item.code} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {locations.error ? <p className="alert">{locations.error}</p> : null}
    </section>
  )
}
