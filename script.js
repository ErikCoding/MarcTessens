import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"

let currentLanguage = localStorage.getItem("preferred-language") || "nl"
let db = null

function initializeFirebase() {
  if (window.firebaseDb) {
    db = window.firebaseDb
    console.log("Firebase initialized successfully")
    return true
  }
  console.error("Firebase not initialized")
  return false
}

function showLoading() {
  document.getElementById("loading-overlay").classList.remove("hidden")
}

function hideLoading() {
  document.getElementById("loading-overlay").classList.add("hidden")
}

async function saveBooking(bookingData) {
  try {
    showLoading()
    const docRef = await addDoc(collection(db, "bookings"), bookingData)
    console.log("Booking saved with ID: ", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error saving booking: ", error)
    throw error
  } finally {
    hideLoading()
  }
}

async function saveMessage(messageData) {
  try {
    showLoading()
    const docRef = await addDoc(collection(db, "messages"), messageData)
    console.log("Message saved with ID: ", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error saving message: ", error)
    throw error
  } finally {
    hideLoading()
  }
}

async function getBookedSlots() {
  try {
    const querySnapshot = await getDocs(collection(db, "bookings"))
    const bookedSlots = {}

    querySnapshot.forEach((doc) => {
      const booking = doc.data()
      const dateKey = booking.date
      if (!bookedSlots[dateKey]) {
        bookedSlots[dateKey] = []
      }
      bookedSlots[dateKey].push(booking.time)
    })

    return bookedSlots
  } catch (error) {
    console.error("Error getting booked slots: ", error)
    return {}
  }
}

async function cancelBookingByEmail(email, reason) {
  try {
    showLoading()
    const q = query(collection(db, "bookings"), where("email", "==", email))
    const querySnapshot = await getDocs(q)

    if (!querySnapshot.empty) {
      const bookingDoc = querySnapshot.docs[0]
      const bookingData = bookingDoc.data()

      // Save cancellation record
      const cancellation = {
        id: Date.now(),
        originalBooking: bookingData,
        reason: reason,
        cancelledAt: new Date().toISOString(),
        type: "cancellation",
      }

      await saveMessage(cancellation)

      // Delete the booking
      await deleteDoc(doc(db, "bookings", bookingDoc.id))

      return true
    }
    return false
  } catch (error) {
    console.error("Error cancelling booking: ", error)
    throw error
  } finally {
    hideLoading()
  }
}

// Added booking calendar system variables and functions
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

document.addEventListener("DOMContentLoaded", async () => {
  // Wait for Firebase to be available
  let attempts = 0
  while (!window.firebaseDb && attempts < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    attempts++
  }

  if (initializeFirebase()) {
    switchLanguage(currentLanguage)
    await generateCalendar()
  } else {
    alert("Fout bij het laden van de applicatie. Probeer de pagina te vernieuwen.")
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

  // Update calendar if it's generated
  if (document.getElementById("calendar-month-year").textContent) {
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
  bookedSlots = await getBookedSlots()

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

  document.getElementById("calendar-month-year").textContent = `${monthNames[month]} ${year}`

  // Clear previous calendar
  const calendarDays = document.getElementById("calendar-days")
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
    const isCurrentMonth = date.getMonth() === month
    const isPastDate = date < today.setHours(0, 0, 0, 0)
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

  const dateKey = date.toISOString().split("T")[0]
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

async function submitBooking(event) {
  event.preventDefault()

  if (!selectedDate || !selectedTime) return

  // Add loading animation
  const submitButton = document.getElementById("booking-submit")
  const originalText = submitButton.textContent
  submitButton.classList.add("loading")
  submitButton.textContent = ""

  try {
    // Get form data
    const name = document.getElementById("booking-name").value
    const email = document.getElementById("booking-email").value
    const phone = document.getElementById("booking-phone").value
    const type = document.getElementById("booking-type").value
    const notes = document.getElementById("booking-notes").value

    // Create booking object
    const booking = {
      date: selectedDate.toISOString().split("T")[0],
      time: selectedTime,
      name: name,
      email: email,
      phone: phone,
      type: type,
      notes: notes,
      created: new Date().toISOString(),
    }

    // Save booking to Firebase
    await saveBooking(booking)

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
    console.error("Error submitting booking:", error)
    alert(
      currentLanguage === "nl"
        ? "Er is een fout opgetreden bij het opslaan van uw afspraak. Probeer het opnieuw."
        : "An error occurred while saving your appointment. Please try again.",
    )

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
    console.error("Error submitting contact form:", error)
    alert(
      currentLanguage === "nl"
        ? "Er is een fout opgetreden bij het verzenden van uw bericht. Probeer het opnieuw."
        : "An error occurred while sending your message. Please try again.",
    )

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
          ? "Geen afspraak gevonden met dit e-mailadres."
          : "No appointment found with this email address.",
      )
    }
  } catch (error) {
    console.error("Error cancelling appointment:", error)
    alert(
      currentLanguage === "nl"
        ? "Er is een fout opgetreden bij het annuleren van uw afspraak. Probeer het opnieuw."
        : "An error occurred while cancelling your appointment. Please try again.",
    )
  }
}

// Observe elements for animation
document.addEventListener("DOMContentLoaded", () => {
  const animateElements = document.querySelectorAll(".service-card, .animate-slide-up")
  animateElements.forEach((el) => observer.observe(el))

  const sectionElements = document.querySelectorAll(".section-reveal")
  sectionElements.forEach((el) => sectionObserver.observe(el))
})
