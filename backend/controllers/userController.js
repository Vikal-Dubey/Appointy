import validator from 'validator'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import userModel from "../models/userModel.js";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";
import jwt from "jsonwebtoken";
import {v2 as cloudinary} from 'cloudinary'  
import razorpay from 'razorpay';

const razorpayInstance = new razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

const parseAddressField = (address) => {
    if (!address) return null
    if (typeof address === 'object') return address
    try {
        return JSON.parse(address)
    } catch {
        return null
    }
}

// API to register user
const registerUser = async (req, res) => {

    try {
        const { name, email, password } = req.body;
        const cleanName = name?.trim()
        const cleanEmail = email?.trim().toLowerCase()
        const cleanPassword = password?.trim()

        // checking for all data to register user
        if (!cleanName || !cleanEmail || !cleanPassword) {
            return res.json({ success: false, message: 'Missing Details' })
        }

        // validating email format
        if (!validator.isEmail(cleanEmail)) {
            return res.json({ success: false, message: "Please enter a valid email" })
        }

        // validating strong password
        if (cleanPassword.length < 8) {
            return res.json({ success: false, message: "Please enter a strong password" })
        }

        const existingUser = await userModel.findOne({ email: cleanEmail })
        if (existingUser) {
            return res.json({ success: false, message: "Account already exists with this email" })
        }

        if (!process.env.JWT_SECRET) {
            return res.json({ success: false, message: "Server configuration error: missing JWT secret" })
        }

        // hashing user password
        const salt = await bcrypt.genSalt(10); // the more no. round the more time it will take
        const hashedPassword = await bcrypt.hash(cleanPassword, salt)

        const userData = {
            name: cleanName,
            email: cleanEmail,
            password: hashedPassword,
        }

        const newUser = new userModel(userData)
        const user = await newUser.save()
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)

        res.json({ success: true, token })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to login user
const loginUser = async (req, res) => {

    try {
        const { email, password } = req.body;
        const cleanEmail = email?.trim().toLowerCase()
        const cleanPassword = password?.trim()

        if (!cleanEmail || !cleanPassword) {
            return res.json({ success: false, message: "Email and password are required" })
        }

        if (!process.env.JWT_SECRET) {
            return res.json({ success: false, message: "Server configuration error: missing JWT secret" })
        }

        const user = await userModel.findOne({ email: cleanEmail })

        if (!user) {
            return res.json({ success: false, message: "User does not exist" })
        }

        const isMatch = await bcrypt.compare(cleanPassword, user.password)

        if (isMatch) {
            const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET)
            res.json({ success: true, token })
        }
        else {
            res.json({ success: false, message: "Invalid credentials" })
        }
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user profile data
const getProfile = async (req, res) => {

    try {
        const userId = req.userId || req.body.userId

        if (!userId) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }

        const userData = await userModel.findById(userId).select('-password')

        if (!userData) {
            return res.json({ success: false, message: 'User not found' })
        }

        res.json({ success: true, userData })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to update user profile
const updateProfile = async (req, res) => {

    try {

        const userId = req.userId || req.body.userId
        const { name, phone, address, dob, gender } = req.body
        const imageFile = req.file

        if (!userId) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }

        if (!name || !phone || !dob || !gender) {
            return res.json({ success: false, message: "Data Missing" })
        }

        const parsedAddress = parseAddressField(address)
        if (!parsedAddress) {
            return res.json({ success: false, message: "Invalid address data" })
        }

        await userModel.findByIdAndUpdate(userId, { name, phone, address: parsedAddress, dob, gender })

        if (imageFile) {

            // upload image to cloudinary
            const imageUpload = await cloudinary.uploader.upload(imageFile.path, { resource_type: "image" })
            const imageURL = imageUpload.secure_url

            await userModel.findByIdAndUpdate(userId, { image: imageURL })
        }

        res.json({ success: true, message: 'Profile Updated' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to book appointment 
const bookAppointment = async (req, res) => {

    try {

        const userId = req.userId || req.body.userId
        const { docId, slotDate, slotTime } = req.body

        if (!userId || !docId || !slotDate || !slotTime) {
            return res.json({ success: false, message: 'Missing appointment details' })
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET || !process.env.CURRENCY) {
            return res.json({ success: false, message: 'Payment gateway is not configured on server' })
        }

        const docData = await doctorModel.findById(docId).select("-password")

        if (!docData) {
            return res.json({ success: false, message: 'Doctor not found' })
        }

        if (!docData.available) {
            return res.json({ success: false, message: 'Doctor Not Available' })
        }

        const slots_booked = docData.slots_booked || {}

        // checking for slot availablity (slot is only locked after deposit payment is verified)
        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot Not Available' })
            }
        }

        const userData = await userModel.findById(userId).select("-password")

        if (!userData) {
            return res.json({ success: false, message: 'User not found' })
        }

        const docDataCopy = docData.toObject()
        delete docDataCopy.slots_booked

        const depositAmount = docData.fees * 0.20

        const appointmentData = {
            userId: userId.toString(),
            docId: docId.toString(),
            userData,
            docData: docDataCopy,
            amount: depositAmount,
            slotTime,
            slotDate,
            date: Date.now(),
            payment: false,
            isCompleted: false
        }

        const newAppointment = new appointmentModel(appointmentData)
        await newAppointment.save()

        const options = {
            amount: Math.round(depositAmount * 100),
            currency: process.env.CURRENCY,
            receipt: newAppointment._id.toString(),
        }

        const order = await razorpayInstance.orders.create(options)

        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID,
            appointmentId: newAppointment._id
        })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }

}

// API to cancel appointment
const cancelAppointment = async (req, res) => {
    try {

        const userId = req.userId || req.body.userId
        const { appointmentId } = req.body

        if (!userId || !appointmentId) {
            return res.json({ success: false, message: 'Missing cancellation details' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        // verify appointment user 
        if (appointmentData.userId.toString() !== userId.toString()) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true })

        // releasing doctor slot only if deposit was paid and slot was locked
        if (appointmentData.payment) {
            const { docId, slotDate, slotTime } = appointmentData

            const doctorData = await doctorModel.findById(docId)

            if (doctorData?.slots_booked?.[slotDate]) {
                let slots_booked = doctorData.slots_booked
                slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)
                await doctorModel.findByIdAndUpdate(docId, { slots_booked })
            }
        }

        res.json({ success: true, message: 'Appointment Cancelled' })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to get user appointments for frontend my-appointments page
const listAppointment = async (req, res) => {
    try {

        const userId = req.userId || req.body.userId

        if (!userId) {
            return res.json({ success: false, message: 'Not Authorized Login Again' })
        }

        const appointments = await appointmentModel.find({ userId: userId.toString() })

        res.json({ success: true, appointments })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to make payment of appointment using razorpay
const paymentRazorpay = async (req, res) => {
    try {

        const userId = req.userId || req.body.userId
        const { appointmentId } = req.body

        if (!appointmentId) {
            return res.json({ success: false, message: 'Appointment ID is required' })
        }

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData || appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment Cancelled or not found' })
        }

        if (appointmentData.userId.toString() !== userId?.toString()) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.payment) {
            return res.json({ success: false, message: 'Appointment is already paid' })
        }

        // creating options for razorpay payment
        const options = {
            amount: Math.round(appointmentData.amount * 100),
            currency: process.env.CURRENCY,
            receipt: appointmentId.toString(),
        }

        // creation of an order
        const order = await razorpayInstance.orders.create(options)

        res.json({
            success: true,
            order,
            key_id: process.env.RAZORPAY_KEY_ID
        })

    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}

// API to verify payment of razorpay
const verifyRazorpay = async (req, res) => {
    try {
        const userId = req.userId || req.body.userId
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.json({ success: false, message: 'Payment verification data missing' })
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.json({ success: false, message: 'Payment gateway is not configured on server' })
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id

        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return res.json({ success: false, message: 'Invalid payment signature' })
        }

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id)
        const appointmentId = orderInfo.receipt

        const appointmentData = await appointmentModel.findById(appointmentId)

        if (!appointmentData) {
            return res.json({ success: false, message: 'Appointment not found' })
        }

        if (appointmentData.userId.toString() !== userId?.toString()) {
            return res.json({ success: false, message: 'Unauthorized action' })
        }

        if (appointmentData.cancelled) {
            return res.json({ success: false, message: 'Appointment has been cancelled' })
        }

        if (appointmentData.payment) {
            return res.json({ success: true, message: "Payment Successful" })
        }

        const { docId, slotDate, slotTime } = appointmentData

        const doctorData = await doctorModel.findById(docId)

        if (!doctorData) {
            return res.json({ success: false, message: 'Doctor not found' })
        }

        let slots_booked = doctorData.slots_booked || {}

        if (slots_booked[slotDate]) {
            if (slots_booked[slotDate].includes(slotTime)) {
                return res.json({ success: false, message: 'Slot no longer available' })
            }
            slots_booked[slotDate].push(slotTime)
        } else {
            slots_booked[slotDate] = []
            slots_booked[slotDate].push(slotTime)
        }

        await doctorModel.findByIdAndUpdate(docId, { slots_booked })
        await appointmentModel.findByIdAndUpdate(appointmentId, { payment: true })

        res.json({ success: true, message: "Payment Successful" })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: error.message })
    }
}


export {registerUser, loginUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, paymentRazorpay, verifyRazorpay}
