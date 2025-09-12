let currentLanguage = localStorage.getItem("preferred-language") || "nl"
let db = null
let appInitialized = false

function initializeFirebase() {
  console.log("[v0] Sprawdzanie inicjalizacji Firebase...")

  if (window.firebaseError) {
    console.error("[v0] Firebase ma błąd:", window.firebaseError)
    return false
  }

  if (window.firebaseInitialized && window.firebaseDb) {
    db = window.firebaseDb
    console.log("[v0] Firebase Realtime Database zainicjalizowany pomyślnie!")
    return true
  }

  console.log("[v0] Firebase jeszcze nie gotowy...")
  return false
}

function showLoading() {
  document.getElementById("loading-overlay").classList.remove("hidden")
}

function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden")
}

function hideInitMessage() {
  const initMessage = document.getElementById("init-message")
  if (initMessage) {
    initMessage.style.display = "none"
  }
}

async function saveBooking(bookingData) {
  try {
    showLoading()
    const bookingsRef = window.firebaseRef(db, "bookings")
    const newBookingRef = window.firebasePush(bookingsRef)
    await window.firebaseSet(newBookingRef, bookingData)
    console.log("[v0] Rezerwacja zapisana z ID: ", newBookingRef.key)
    return newBookingRef.key
  } catch (error) {
    console.error("[v0] Błąd zapisywania rezerwacji: ", error)
    throw error
  } finally {
    hideLoading()
  }
}

async function saveMessage(messageData) {
  try {
    showLoading()
    const messagesRef = window.firebaseRef(db, "messages")
    const newMessageRef = window.firebasePush(messagesRef)
    await window.firebaseSet(newMessageRef, messageData)
    console.log("[v0] Wiadomość zapisana z ID: ", newMessageRef.key)
    return newMessageRef.key
  } catch (error) {
    console.error("[v0] Błąd zapisywania wiadomości: ", error)
    throw error
  } finally {
    hideLoading()
  }
}

async function getBookedSlots() {
  try {
    const bookingsRef = window.firebaseRef(db, "bookings")
    const snapshot = await window.firebaseGet(bookingsRef)
    const bookedSlots = {}

    if (snapshot.exists()) {
      const bookings = snapshot.val()
      Object.keys(bookings).forEach((key) => {
        const booking = bookings[key]
        const dateKey = booking.date
        if (!bookedSlots[dateKey]) {
          bookedSlots[dateKey] = []
        }
        bookedSlots[dateKey].push(booking.time)
      })
    }

    return bookedSlots
  } catch (error) {
    console.error("[v0] Błąd pobierania zajętych terminów: ", error)
    return {}
  }
}

async function cancelBookingByEmail(email, reason) {
  try {
    showLoading()
    const bookingsRef = window.firebaseRef(db, "bookings")
    const snapshot = await window.firebaseGet(bookingsRef)

    if (snapshot.exists()) {
      const bookings = snapshot.val()
      let foundBookingKey = null
      let foundBookingData = null

      // Find booking by email
      Object.keys(bookings).forEach((key) => {
        if (bookings[key].email === email) {
          foundBookingKey = key
          foundBookingData = bookings[key]
        }
      })

      if (foundBookingKey) {
        // Save cancellation record
        const cancellation = {
          id: Date.now(),
          originalBooking: foundBookingData,
          reason: reason,
          cancelledAt: new Date().toISOString(),
          type: "cancellation",
        }

        await saveMessage(cancellation)

        // Delete the booking
        const bookingToDeleteRef = window.firebaseRef(db, `bookings/${foundBookingKey}`)
        await window.firebaseRemove(bookingToDeleteRef)

        return true
      }
    }
    return false
  } catch (error) {
    console.error("[v0] Błąd anulowania rezerwacji: ", error)
    throw error
  } finally {
    hideLoading()
  }
}

const currentDate = new Date()
let selectedDate = null
let selectedTime = null
let bookedSlots = {}

// Available time slots (9:00-17:00, excluding lunch 12:00-13:00)
const timeSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
]

async function initializeApp() {
  console.log("[v0] Rozpoczynanie inicjalizacji aplikacji...")

  // Czekaj na Firebase
  let attempts = 0
  const maxAttempts = 50

  while (!initializeFirebase() && attempts < maxAttempts) {
    console.log(`[v0] Próba Firebase ${attempts + 1}/${maxAttempts}`)
    await new Promise((resolve) => setTimeout(resolve, 200))
    attempts++
  }

  if (attempts >= maxAttempts) {
    console.error("[v0] Timeout inicjalizacji Firebase")
    alert("Błąd ładowania aplikacji. Odśwież stronę i spróbuj ponownie.")
    return
  }

  console.log("[v0] Firebase gotowy, inicjalizacja aplikacji...")

  // Inicjalizuj język
  switchLanguage(currentLanguage)

  await generateCalendar()

  // Ukryj komunikat inicjalizacji
  hideInitMessage()

  appInitialized = true
  console.log("[v0] Aplikacja zainicjalizowana pomyślnie!")
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[v0] DOM załadowany")

  if (window.firebaseInitialized) {
    // Firebase już gotowy
    initializeApp()
  } else {
    // Czekaj na Firebase
    window.addEventListener("firebaseReady", () => {
      console.log("[v0] Otrzymano event firebaseReady")
      initializeApp()
    })

    // Fallback - spróbuj po 2 sekundach
    setTimeout(() => {
      if (!appInitialized) {
        console.log("[v0] Fallback inicjalizacji po timeout")
        initializeApp()
      }
    }, 2000)
  }
})

function switchLanguage(lang) {
  currentLanguage = lang
  localStorage.setItem("preferred-language", lang)

  // Update language buttons
  document.getElementById("lang-nl").className =
    lang === "nl"
      ? "px-3 py-1 bg-green-700 text-white rounded-md text-sm font-medium"
      : "px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm font-medium"
  document.getElementById("lang-en").className =
    lang === "en"
      ? "px-3 py-1 bg-green-700 text-white rounded-md text-sm font-medium"
      : "px-3 py-1 bg-gray-200 text-gray-700 rounded-md text-sm font-medium"

  // Update page title
  document.title =
    lang === "nl" ? "Marc Tessens - Boekhouding & Fiscaal Advies" : "Marc Tessens - Accounting & Tax Advice"

  // Update all elements with data attributes
  document.querySelectorAll("[data-nl]").forEach((element) => {
    if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
      element.placeholder = element.getAttribute(`data-${lang}-placeholder`) || element.getAttribute(`data-${lang}`)
    } else {
      element.textContent = element.getAttribute(`data-${lang}`)
    }
  })

  // Update select options
  document.querySelectorAll("select option[data-nl]").forEach((option) => {
    option.textContent = option.getAttribute(`data-${lang}`)
  })

  // Hide/show language-specific content
  document.querySelectorAll(".hidden-lang").forEach((el) => el.classList.remove("hidden-lang"))
  document.querySelectorAll(`[data-lang]:not([data-lang="${lang}"])`).forEach((el) => el.classList.add("hidden-lang"))

  if (appInitialized) {
    generateCalendar()
  }

  // Update booking button text
  updateBookingButton()
}

function toggleMobileMenu() {
  const menu = document.getElementById("mobile-menu")
  menu.classList.toggle("hidden")
}

async function generateCalendar() {
  console.log("[v0] Generowanie kalendarza...")

  const monthYearElement = document.getElementById("calendar-month-year")
  const calendarDays = document.getElementById("calendar-days")

  if (!monthYearElement || !calendarDays) {
    console.log("[v0] Elementy kalendarza jeszcze nie gotowe, spróbuj ponownie...")
    setTimeout(() => generateCalendar(), 500)
    return
  }

  try {
    if (db) {
      bookedSlots = await getBookedSlots()
      console.log("[v0] Załadowano zajęte terminy:", bookedSlots)
    } else {
      console.log("[v0] Firebase nie gotowy, używam pustych terminów")
      bookedSlots = {}
    }
  } catch (error) {
    console.error("[v0] Błąd ładowania zajętych terminów:", error)
    bookedSlots = {}
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Update month/year display
  const monthNames =
    currentLanguage === "nl"
      ? [
          "Januari",
          "Februari",
          "Maart",
          "April",
          "Mei",
          "Juni",
          "Juli",
          "Augustus",
          "September",
          "Oktober",
          "November",
          "December",
        ]
      : [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ]

  monthYearElement.textContent = `${monthNames[month]} ${year}`

  // Clear previous calendar
  calendarDays.innerHTML = ""

  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startDate = new Date(firstDay)
  startDate.setDate(startDate.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1))

  // Generate calendar days
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate)
    date.setDate(startDate.getDate() + i)

    const dayElement = document.createElement("div")
    dayElement.className = "text-center p-2 cursor-pointer rounded-lg transition-colors"
    dayElement.textContent = date.getDate()

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Reset time to avoid timezone issues
    const isCurrentMonth = date.getMonth() === month
    const isPastDate = date < today
    const isWeekend = date.getDay() === 0 || date.getDay() === 6

    if (!isCurrentMonth) {
      dayElement.className += " text-gray-300"
    } else if (isPastDate || isWeekend) {
      dayElement.className += " text-gray-400 cursor-not-allowed"
    } else {
      dayElement.className += " text-gray-700 hover:bg-green-100"
      dayElement.onclick = () => selectDate(date)
    }

    calendarDays.appendChild(dayElement)
  }

  console.log("[v0] Kalendarz wygenerowany pomyślnie")
}

function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1)
  generateCalendar()
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1)
  generateCalendar()
}

function selectDate(date) {
  selectedDate = date
  selectedTime = null

  // Update selected date styling
  document.querySelectorAll("#calendar-days > div").forEach((day) => {
    day.classList.remove("bg-green-700", "text-white")
    if (day.textContent == date.getDate() && !day.classList.contains("text-gray-300")) {
      day.classList.add("bg-green-700", "text-white")
    }
  })

  // Show time slots
  showTimeSlots(date)
  updateBookingButton()
}

function showTimeSlots(date) {
  const timeSlotsContainer = document.getElementById("time-slots")
  const timeSlotsGrid = document.getElementById("time-slots-grid")

  timeSlotsContainer.classList.remove("hidden")
  timeSlotsGrid.innerHTML = ""

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const dateKey = `${year}-${month}-${day}`

  const bookedTimes = bookedSlots[dateKey] || []

  timeSlots.forEach((time) => {
    const timeButton = document.createElement("button")
    timeButton.type = "button"
    timeButton.textContent = time
    timeButton.className = "p-3 border border-gray-300 rounded-lg text-center transition-colors"

    if (bookedTimes.includes(time)) {
      timeButton.className += " bg-gray-200 text-gray-500 cursor-not-allowed"
      timeButton.disabled = true
    } else {
      timeButton.className += " hover:bg-green-100 hover:border-green-300"
      timeButton.onclick = () => selectTime(time, timeButton)
    }

    timeSlotsGrid.appendChild(timeButton)
  })
}

function selectTime(time, buttonElement) {
  selectedTime = time

  // Update selected time styling
  document.querySelectorAll("#time-slots-grid button").forEach((btn) => {
    btn.classList.remove("bg-green-700", "text-white")
    btn.classList.add("hover:bg-green-100", "hover:border-green-300")
  })

  buttonElement.classList.remove("hover:bg-green-100", "hover:border-green-300")
  buttonElement.classList.add("bg-green-700", "text-white")

  updateBookingSummary()
  updateBookingButton()
}

function updateBookingSummary() {
  if (selectedDate && selectedTime) {
    const summary = document.getElementById("booking-summary")
    const datetime = document.getElementById("booking-datetime")

    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }

    const formattedDate = selectedDate.toLocaleDateString(currentLanguage === "nl" ? "nl-NL" : "en-US", options)
    datetime.textContent = `${formattedDate} om ${selectedTime}`

    summary.classList.remove("hidden")
  }
}

function updateBookingButton() {
  const submitButton = document.getElementById("booking-submit")

  if (!submitButton) return

  if (selectedDate && selectedTime) {
    submitButton.disabled = false
    submitButton.className =
      "w-full bg-green-700 hover:bg-green-800 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
    submitButton.textContent = currentLanguage === "nl" ? "Afspraak Bevestigen" : "Confirm Appointment"
  } else {
    submitButton.disabled = true
    submitButton.className = "w-full bg-gray-400 text-white font-semibold py-3 rounded-lg cursor-not-allowed"
    submitButton.textContent =
      currentLanguage === "nl" ? "Selecteer eerst een datum en tijd" : "Please select a date and time first"
  }
}

async function submitBooking(event) {
  event.preventDefault()
  console.log("[v0] Wysyłanie rezerwacji...")

  if (!selectedDate || !selectedTime) {
    console.log("[v0] Brak wybranej daty lub czasu")
    alert("Wybierz datę i czas przed wysłaniem formularza.")
    return
  }

  if (!db) {
    console.error("[v0] Baza danych nie zainicjalizowana")
    alert("Baza danych nie jest gotowa. Odśwież stronę i spróbuj ponownie.")
    return
  }

  // Add loading animation
  const submitButton = document.getElementById("booking-submit")
  const originalText = submitButton.textContent
  submitButton.classList.add("loading")
  submitButton.textContent = ""

  try {
    console.log("[v0] Pobieranie danych formularza...")
    // Get form data
    const name = document.getElementById("booking-name").value
    const email = document.getElementById("booking-email").value
    const phone = document.getElementById("booking-phone").value
    const type = document.getElementById("booking-type").value
    const notes = document.getElementById("booking-notes").value

    console.log("[v0] Dane formularza:", { name, email, phone, type, notes })

    const year = selectedDate.getFullYear()
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
    const day = String(selectedDate.getDate()).padStart(2, "0")
    const dateString = `${year}-${month}-${day}`

    // Create booking object
    const booking = {
      date: dateString,
      time: selectedTime,
      name: name,
      email: email,
      phone: phone,
      type: type,
      notes: notes,
      created: new Date().toISOString(),
    }

    console.log("[v0] Obiekt rezerwacji:", booking)
    console.log("[v0] Próba zapisania rezerwacji...")

    // Save booking to Firebase
    await saveBooking(booking)

    console.log("[v0] Rezerwacja zapisana pomyślnie!")

    // Remove loading animation
    submitButton.classList.remove("loading")
    submitButton.textContent = originalText

    // Show success message with animation
    document.getElementById("booking-form").style.transform = "translateX(-100%)"
    document.getElementById("booking-form").style.opacity = "0"

    setTimeout(() => {
      document.getElementById("booking-form").classList.add("hidden")
      document.getElementById("booking-success").classList.remove("hidden")
      document.getElementById("booking-success").style.transform = "translateX(100%)"
      document.getElementById("booking-success").style.opacity = "0"

      setTimeout(() => {
        document.getElementById("booking-success").style.transform = "translateX(0)"
        document.getElementById("booking-success").style.opacity = "1"
      }, 50)
    }, 300)

    // Reset form and selections
    selectedDate = null
    selectedTime = null
    document.getElementById("time-slots").classList.add("hidden")
    await generateCalendar()

    // Scroll to success message
    setTimeout(() => {
      document.getElementById("booking-success").scrollIntoView({ behavior: "smooth" })
    }, 400)
  } catch (error) {
    console.error("[v0] Błąd wysyłania rezerwacji:", error)
    console.error("[v0] Szczegóły błędu:", error.message, error.stack)

    let errorMessage = "Wystąpił błąd podczas zapisywania rezerwacji."
    if (error.message.includes("permission")) {
      errorMessage += " Problem z uprawnieniami Firebase."
    } else if (error.message.includes("network")) {
      errorMessage += " Sprawdź połączenie internetowe."
    }
    errorMessage += " Spróbuj ponownie."

    alert(errorMessage)

    // Remove loading animation
    submitButton.classList.remove("loading")
    submitButton.textContent = originalText
  }
}

async function handleContactForm(event) {
  event.preventDefault()
  const submitButton = event.target.querySelector('button[type="submit"]')
  const originalText = submitButton.textContent

  // Add loading animation
  submitButton.classList.add("loading")
  submitButton.textContent = ""

  try {
    const name = document.getElementById("contact-name").value
    const email = document.getElementById("contact-email").value
    const subject = document.getElementById("contact-subject").value
    const message = document.getElementById("contact-message").value

    const contactMessage = {
      name: name,
      email: email,
      subject: subject,
      message: message,
      created: new Date().toISOString(),
      type: "contact",
    }

    // Save to Firebase
    await saveMessage(contactMessage)

    // Remove loading animation
    submitButton.classList.remove("loading")
    submitButton.textContent = originalText

    if (name && email && subject && message) {
      // Hide form and show success message
      event.target.style.display = "none"
      document.getElementById("contact-success").classList.remove("hidden")

      // Reset form after delay
      setTimeout(() => {
        event.target.reset()
        event.target.style.display = "block"
        document.getElementById("contact-success").classList.add("hidden")
      }, 5000)
    }
  } catch (error) {
    console.error("[v0] Błąd wysyłania formularza kontaktowego:", error)
    alert("Wystąpił błąd podczas wysyłania wiadomości. Spróbuj ponownie.")

    // Remove loading animation
    submitButton.classList.remove("loading")
    submitButton.textContent = originalText
  }
}

function showCancelForm() {
  document.getElementById("cancel-form").classList.remove("hidden")
  document.getElementById("cancel-email").focus()
}

function hideCancelForm() {
  document.getElementById("cancel-form").classList.add("hidden")
  document.getElementById("cancel-email").value = ""
  document.getElementById("cancel-reason").value = ""
}

async function cancelAppointment(event) {
  event.preventDefault()

  const email = document.getElementById("cancel-email").value
  const reason = document.getElementById("cancel-reason").value

  try {
    const success = await cancelBookingByEmail(email, reason)

    if (success) {
      // Hide form and show success
      document.getElementById("cancel-form").classList.add("hidden")
      document.getElementById("cancel-success").classList.remove("hidden")

      // Hide booking success message
      document.getElementById("booking-success").classList.add("hidden")

      // Regenerate calendar to show freed slot
      await generateCalendar()
    } else {
      alert(
        currentLanguage === "nl"
          ? "Nie znaleziono rezerwacji z tym adresem e-mail."
          : "No appointment found with this email address.",
      )
    }
  } catch (error) {
    console.error("[v0] Błąd anulowania rezerwacji:", error)
    alert("Wystąpił błąd podczas anulowania rezerwacji. Spróbuj ponownie.")
  }
}

const observerOptions = {
  threshold: 0.1,
  rootMargin: "0px 0px -50px 0px",
}

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry, index) => {
    if (entry.isIntersecting) {
      // Add staggered delay for multiple elements
      setTimeout(() => {
        entry.target.classList.add("animate-slide-up")
        entry.target.classList.add("revealed")
      }, index * 100)
    }
  })
}, observerOptions)

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("revealed")
    }
  })
}, observerOptions)

// Observe elements for animation
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    const animateElements = document.querySelectorAll(".service-card, .animate-slide-up")
    animateElements.forEach((el) => observer.observe(el))

    const sectionElements = document.querySelectorAll(".section-reveal")
    sectionElements.forEach((el) => sectionObserver.observe(el))
  }, 1000)
})
