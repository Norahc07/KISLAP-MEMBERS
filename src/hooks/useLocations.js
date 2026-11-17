import { useEffect, useMemo, useState } from 'react'
import { loadBarangays, loadCities, loadProvinces } from '../lib/locations'

export function useLocations(provinceName, cityName) {
  const [provinces, setProvinces] = useState([])
  const [cities, setCities] = useState([])
  const [barangays, setBarangays] = useState([])
  const [citySource, setCitySource] = useState('')
  const [barangaySource, setBarangaySource] = useState('')
  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [error, setError] = useState('')
  const province = provinces.find((item) => item.name === provinceName)
  const citiesForProvince = useMemo(() => (citySource === provinceName ? cities : []), [cities, citySource, provinceName])
  const barangaysForCity = useMemo(() => (barangaySource === cityName ? barangays : []), [barangays, barangaySource, cityName])

  useEffect(() => {
    let ignore = false
    loadProvinces()
      .then((rows) => {
        if (!ignore) setProvinces(rows)
      })
      .catch(() => {
        if (!ignore) setError('The province list could not be loaded. Check your connection and open this step again.')
      })
      .finally(() => {
        if (!ignore) setLoadingProvinces(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    if (!province) {
      setCities([])
      setCitySource('')
      return undefined
    }
    let ignore = false
    setCitySource('')
    setError('')
    loadCities(province)
      .then((rows) => {
        if (!ignore) {
          setCities(rows)
          setCitySource(province.name)
        }
      })
      .catch(() => {
        if (!ignore) setError('The city and municipality list could not be loaded. Check your connection and choose the province again.')
      })
    return () => {
      ignore = true
    }
  }, [provinceName, provinces])

  useEffect(() => {
    const city = citiesForProvince.find((item) => item.name === cityName)
    if (!city) return undefined
    let ignore = false
    setBarangaySource('')
    setError('')
    loadBarangays(city.code)
      .then((rows) => {
        if (!ignore) {
          setBarangays(rows)
          setBarangaySource(city.name)
        }
      })
      .catch(() => {
        if (!ignore) setError('The barangay list could not be loaded. Check your connection and choose the city again.')
      })
    return () => {
      ignore = true
    }
  }, [cityName, citiesForProvince])

  return {
    provinces,
    cities: citiesForProvince,
    barangays: barangaysForCity,
    loadingProvinces,
    loadingCities: Boolean(province) && citySource !== provinceName,
    loadingBarangays: Boolean(cityName) && barangaySource !== cityName,
    error,
  }
}
