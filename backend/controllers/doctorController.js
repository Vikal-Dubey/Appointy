import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import doctorModel from "../models/doctorModel.js";
import appointmentModel from "../models/appointmentModel.js";

const parseAddressField = (address) => {
  if (!address) return null
  if (typeof address === 'object') return address
  try {
    return JSON.parse(address)
  } catch {
    return null
  }
}

const releaseDoctorSlot = async (appointment) => {
  if (!appointment?.payment) return

  const { docId, slotDate, slotTime } = appointment
  const doctorData = await doctorModel.findById(docId)

  if (doctorData?.slots_booked?.[slotDate]) {
    const slots_booked = doctorData.slots_booked
    slots_booked[slotDate] = slots_booked[slotDate].filter(e => e !== slotTime)
    await doctorModel.findByIdAndUpdate(docId, { slots_booked })
  }
}

// Doctor login
const loginDoctor = async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = email?.trim().toLowerCase()
    const cleanPassword = password?.trim()

    if (!cleanEmail || !cleanPassword) {
      return res.json({ success: false, message: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.json({ success: false, message: "Server configuration error: missing JWT secret" });
    }

    const user = await doctorModel.findOne({ email: cleanEmail });

    if (!user) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.password);
    if (!isMatch) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ success: true, token });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// Get doctor's appointments
const appointmentsDoctor = async (req, res) => {
  try {
    const docId = req.user.id;
    const appointments = await appointmentModel.find({ docId: docId.toString() });
    res.json({ success: true, appointments });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// Cancel appointment
const appointmentCancel = async (req, res) => {
  try {
    const docId = req.user.id;
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.json({ success: false, message: "Appointment ID is required" });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment || appointment.docId.toString() !== docId.toString()) {
      return res.json({ success: false, message: "Invalid doctor or appointment" });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { cancelled: true });
    await releaseDoctorSlot(appointment);

    res.json({ success: true, message: "Appointment Cancelled" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// Complete appointment
const appointmentComplete = async (req, res) => {
  try {
    const docId = req.user.id;
    const { appointmentId } = req.body;

    if (!appointmentId) {
      return res.json({ success: false, message: "Appointment ID is required" });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment || appointment.docId.toString() !== docId.toString()) {
      return res.json({ success: false, message: "Invalid doctor or appointment" });
    }

    if (!appointment.payment) {
      return res.json({ success: false, message: "Cannot complete an unpaid appointment" });
    }

    await appointmentModel.findByIdAndUpdate(appointmentId, { isCompleted: true });
    res.json({ success: true, message: "Appointment Completed" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// Get all doctors (for frontend list)
const doctorList = async (req, res) => {
  try {
    const doctors = await doctorModel.find({}).select("-password -email");
    res.json({ success: true, doctors });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// Toggle doctor's availability
  const changeAvailability = async (req, res) => {
  try {
    const { docId } = req.body;

    if (!docId) {
      return res.json({ success: false, message: "Doctor ID missing" });
    }

    const doctor = await doctorModel.findById(docId);

    if (!doctor) {
      return res.json({ success: false, message: "Doctor not found" });
    }

    doctor.available = !doctor.available;
    await doctor.save();

    res.json({ success: true, message: "Availability changed successfully" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};


// Get doctor's profile
const doctorProfile = async (req, res) => {
  try {
    const docId = req.user.id;
    const profile = await doctorModel.findById(docId).select("-password");

    if (!profile) {
      return res.json({ success: false, message: "Doctor not found" });
    }

    res.json({ success: true, profileData: profile });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

// Update doctor's profile
const updateDoctorProfile = async (req, res) => {
  try {
    const docId = req.user.id;
    const { fees, address, available, about } = req.body;

    const updatePayload = {}

    if (fees !== undefined) {
      const parsedFees = Number(fees)
      if (!Number.isFinite(parsedFees) || parsedFees <= 0) {
        return res.json({ success: false, message: "Please enter a valid fee amount" });
      }
      updatePayload.fees = parsedFees
    }

    if (address !== undefined) {
      const parsedAddress = parseAddressField(address)
      if (!parsedAddress) {
        return res.json({ success: false, message: "Invalid address data" });
      }
      updatePayload.address = parsedAddress
    }

    if (available !== undefined) {
      updatePayload.available = available === true || available === 'true'
    }

    if (about !== undefined) {
      updatePayload.about = about
    }

    await doctorModel.findByIdAndUpdate(docId, updatePayload);

    res.json({ success: true, message: "Profile Updated" });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};


// Get dashboard data
const doctorDashboard = async (req, res) => {
  try {
    const docId = req.user.id;
    const appointments = await appointmentModel.find({ docId: docId.toString(), payment: true });

    let earnings = 0;
    const patientSet = new Set();

    appointments.forEach((a) => {
      earnings += a.amount;
      patientSet.add(a.userId.toString());
    });

    const dashData = {
      earnings,
      appointments: appointments.length,
      patients: patientSet.size,
      latestAppointments: [...appointments].reverse().slice(0, 5),
    };

    res.json({ success: true, dashData });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: error.message });
  }
};

export {
  loginDoctor,
  appointmentsDoctor,
  appointmentCancel,
  appointmentComplete,
  doctorList,
  changeAvailability,
  doctorProfile,
  updateDoctorProfile,
  doctorDashboard,
};
