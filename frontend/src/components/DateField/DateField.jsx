import { useEffect, useRef } from 'react'
import flatpickr from 'flatpickr'
import { Finnish } from 'flatpickr/dist/l10n/fi.js'
import 'flatpickr/dist/flatpickr.css'
import './DateField.css'

export default function DateField({
  value,
  onChange,
  placeholder = 'pp.kk.vvvv',
  required = false,
  className = 'date-input',
  ariaLabel,
}) {
  const inputRef = useRef(null)
  const pickerRef = useRef(null)

  useEffect(() => {
    if (!inputRef.current) return undefined
    pickerRef.current = flatpickr(inputRef.current, {
      locale: Finnish,
      dateFormat: 'Y-m-d',
      altInput: true,
      altFormat: 'd.m.Y',
      altInputClass: `${className} themed-date-field`,
      allowInput: true,
      disableMobile: true,
      defaultDate: value || undefined,
      onReady: (_dates, _dateString, instance) => {
        if (ariaLabel) instance.altInput?.setAttribute('aria-label', ariaLabel)
      },
      onChange: (_dates, dateString) => onChange(dateString),
      onClose: (_dates, dateString) => {
        if (dateString !== value) onChange(dateString)
      },
    })
    return () => {
      pickerRef.current?.destroy()
      pickerRef.current = null
    }
    // Flatpickr is initialized once; value updates are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (pickerRef.current && pickerRef.current.input.value !== (value || '')) {
      pickerRef.current.setDate(value || null, false, 'Y-m-d')
    }
  }, [value])

  return (
    <input
      ref={inputRef}
      className={className}
      type="hidden"
      placeholder={placeholder}
      required={required}
      aria-label={ariaLabel}
      autoComplete="off"
    />
  )
}
