import React, { useCallback, useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppContext } from './context/AppContext'
import { assets } from './assets/assets'
import RelatedDoctors from './components/RelatedDoctors'
import axios from 'axios'
import { toast } from 'react-toastify'

const Appointment = () => {
  const { docId } = useParams()
  const navigate = useNavigate()
  const { doctors, currencySymbol, backendUrl, token, getDoctorsData } = useContext(AppContext)
  const daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

  const [docInfo, setDocInfo] = useState(null)
  const [docSlots, setDocSlots] = useState([])
  const [slotIndex, setSlotIndex] = useState(0)
  const [slotTime, setSlotTime] = useState('')
  const [isBooking, setIsBooking] = useState(false)

  const fetchDocInfo = useCallback(async () => {
    const doc = doctors.find((doc) => doc._id === docId)
    if (doc) {
      // Ensure slots_booked is always at least an empty object
      setDocInfo({ ...doc, slots_booked: doc.slots_booked || {} })
    }
  }, [doctors, docId])

  const getAvailableSlots = useCallback(() => {
    if (!docInfo) return
    setDocSlots([])

    const today = new Date()

    for (let i = 0; i < 7; i++) {
      const currentDate = new Date(today)
      currentDate.setDate(today.getDate() + i)

      const endTime = new Date(currentDate)
      endTime.setHours(21, 0, 0, 0)

      if (today.getDate() === currentDate.getDate()) {
        currentDate.setHours(currentDate.getHours() > 10 ? currentDate.getHours() + 1 : 10)
        currentDate.setMinutes(currentDate.getMinutes() > 30 ? 30 : 0)
      } else {
        currentDate.setHours(10)
        currentDate.setMinutes(0)
      }

      const timeSlots = []

      while (currentDate < endTime) {
        const formattedTime = currentDate.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })

        const day = currentDate.getDate()
        const month = currentDate.getMonth() + 1
        const year = currentDate.getFullYear()
        const slotDate = `${day}_${month}_${year}`
        const slotTime = formattedTime

        const isSlotAvailable =
          !docInfo?.slots_booked?.[slotDate] ||
          !docInfo.slots_booked[slotDate].includes(slotTime)

        if (isSlotAvailable) {
          timeSlots.push({
            datetime: new Date(currentDate),
            time: formattedTime
          })
        }

        currentDate.setMinutes(currentDate.getMinutes() + 30)
      }

      setDocSlots((prev) => [...prev, timeSlots])
    }
  }, [docInfo])

  const bookAppointment = async () => {

    if (!token) {
      toast.warning('Login to book appointment')
      return navigate('/login')
    }

    if (!slotTime) {
      toast.warning('Please select a time slot')
      return
    }

    if (isBooking) return

    const selectedDaySlots = docSlots[slotIndex]
    if (!selectedDaySlots?.length) {
      toast.warning('No slots available for the selected day')
      return
    }

    const date = selectedDaySlots[0].datetime
  
    let day = date.getDate()
    let month = date.getMonth() + 1
    let year = date.getFullYear()

    const slotDate = day + "_" + month + "_" + year

    setIsBooking(true)

    try {

      const { data } = await axios.post(backendUrl + '/api/user/book-appointment', { docId, slotDate, slotTime }, { headers: { token } })

      if (!data.success) {
        toast.error(data.message)
        setIsBooking(false)
        return
      }

      const { order, key_id } = data

      if (!key_id) {
        toast.error('Razorpay key is missing. Please check payment configuration.')
        setIsBooking(false)
        return
      }

      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Appointment Booking',
        description: '20% Confirmation Deposit',
        order_id: order.id,
        handler: async (response) => {
          try {
            const { data: verifyData } = await axios.post(backendUrl + '/api/user/verifyRazorpay', response, { headers: { token } })
            if (verifyData.success) {
              toast.success('Appointment Booked Successfully')
              getDoctorsData()
              navigate('/my-appointments')
            } else {
              toast.error(verifyData.message)
            }
          } catch (error) {
            console.log(error)
            toast.error(error.message)
          } finally {
            setIsBooking(false)
          }
        },
        modal: {
          ondismiss: function () {
            setIsBooking(false)
            toast.info('Payment cancelled. Your slot was not reserved.')
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function () {
        setIsBooking(false)
        toast.error('Payment failed. Please try again.')
      })
      rzp.open()

    } catch (error) {
      console.log(error)
      toast.error(error.message)
      setIsBooking(false)
    }

  }

  useEffect(() => {
    if (doctors.length > 0) {
      fetchDocInfo()
    }
  }, [doctors, docId, fetchDocInfo])

  useEffect(() => {
    if (docInfo) {
      getAvailableSlots()
    }
  }, [docInfo, getAvailableSlots])

  return (
    docInfo && (
      <div>
        {/* Doctor details */}
        <div className='flex flex-col sm:flex-row gap-4'>
          <div>
            <img className='bg-primary w-full sm:max-w-72 rounded-lg' src={docInfo.image} alt="" />
          </div>
          <div className='flex-1 border border-[#ADADAD] rounded-lg p-8 py-7 bg-white mx-2 sm:mx-0 mt-[-80px] sm:mt-0'>
            <p className='flex items-center gap-2 text-3xl font-medium text-gray-700'>
              {docInfo.name} <img src={assets.verified_icon} alt="" />
            </p>
            <div className='flex items-center gap-2 mt-1 text-gray-600'>
              <p>{docInfo.degree} - {docInfo.speciality}</p>
              <button className='py-0.5 px-2 border text-xs rounded-full'>{docInfo.experience}</button>
            </div>
            <div>
              <p className='flex items-center gap-1 text-sm font-medium text-[#262626] mt-3'>
                About <img src={assets.info_icon} alt="" />
              </p>
              <p className='text-sm text-gray-600 max-w-[700px] mt-1'>{docInfo.about}</p>
            </div>
            <p className='text-gray-600 font-medium mt-4'>
              Appointment fee: <span className='text-gray-800'>{currencySymbol} {docInfo.fees}</span>
            </p>
            <p className='text-sm text-gray-500 mt-1'>
              20% confirmation deposit ({currencySymbol}{Math.round(docInfo.fees * 0.2)}) required to book. Remaining 80% due at the clinic.
            </p>
          </div>
        </div>

        {/* Booking Slots */}
        <div className='sm:ml-72 sm:pl-4 mt-8 font-medium text-[#565656]'>
          <p>Booking slots</p>

          {/* Days Scroll */}
          <div className='flex gap-3 items-center w-full overflow-x-scroll mt-4'>
            {docSlots.length > 0 &&
              docSlots.map((item, index) => (
                <div
                  onClick={() => setSlotIndex(index)}
                  key={index}
                  className={`text-center py-6 min-w-16 rounded-full cursor-pointer ${slotIndex === index ? 'bg-primary text-white' : 'border border-[#DDDDDD]'
                    }`}
                >
                  <p>{item[0] && daysOfWeek[item[0].datetime.getDay()]}</p>
                  <p>{item[0] && item[0].datetime.getDate()}</p>
                </div>
              ))}
          </div>

          {/* Time Slots Scroll */}
          <div className='flex items-center gap-3 w-full overflow-x-scroll mt-4'>
            {docSlots.length > 0 &&
              docSlots[slotIndex] &&
              docSlots[slotIndex].map((item, index) => (
                <p
                  onClick={() => setSlotTime(item.time)}
                  key={index}
                  className={`text-sm font-light flex-shrink-0 px-5 py-2 rounded-full cursor-pointer ${item.time === slotTime
                      ? 'bg-primary text-white'
                      : 'text-[#949494] border border-[#B4B4B4]'
                    }`}
                >
                  {item.time.toLowerCase()}
                </p>
              ))}
          </div>

          {/* Book Button */}
          <button
            onClick={bookAppointment}
            disabled={isBooking}
            className='bg-primary text-white text-sm font-light px-20 py-3 rounded-full my-6 disabled:opacity-60'
          >
            {isBooking ? 'Processing...' : 'Book an appointment'}
          </button>
        </div>

        {/* Related Doctors */}
        <RelatedDoctors speciality={docInfo.speciality} docId={docId} />
      </div>
    )
  )
}

export default Appointment
