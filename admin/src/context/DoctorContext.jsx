import { createContext, useCallback, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

/* eslint-disable react-refresh/only-export-components */
export const DoctorContext = createContext();

const DoctorContextProvider = (props) => {
  const backendUrl = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');

  const [dToken, setDToken] = useState(
    localStorage.getItem("dToken") || ""
  );
  const [appointments, setAppointments] = useState([]);
  const [dashData, setDashData] = useState(false);
  const [profileData, setProfileData] = useState(false);

  const authHeader = useMemo(() => ({
    headers: {
      Authorization: `Bearer ${dToken}`,
    },
  }), [dToken]);

  const getAppointments = useCallback(async () => {
    try {
      const { data } = await axios.get(
        backendUrl + "/api/doctor/appointments",
        authHeader
      );

      if (data.success) {
        setAppointments(data.appointments.reverse());
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }, [backendUrl, authHeader]);

  const getDashData = useCallback(async () => {
    try {
      const { data } = await axios.get(
        backendUrl + "/api/doctor/dashboard",
        authHeader
      );

      if (data.success) {
        setDashData(data.dashData);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }, [backendUrl, authHeader]);

  const completeAppointment = useCallback(async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/doctor/complete-appointment",
        { appointmentId },
        authHeader
      );

      if (data.success) {
        toast.success(data.message);
        getAppointments();
        getDashData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }, [backendUrl, authHeader, getAppointments, getDashData]);

  const cancelAppointment = useCallback(async (appointmentId) => {
    try {
      const { data } = await axios.post(
        backendUrl + "/api/doctor/cancel-appointment",
        { appointmentId },
        authHeader
      );

      if (data.success) {
        toast.success(data.message);
        getAppointments();
        getDashData();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }, [backendUrl, authHeader, getAppointments, getDashData]);

  const getProfileData = useCallback(async () => {
    try {
      const { data } = await axios.get(
        backendUrl + "/api/doctor/profile",
        authHeader
      );

      if (data.success) {
        setProfileData({
          ...data.profileData,
          address: data.profileData.address || { line1: '', line2: '' },
        });
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message);
    }
  }, [backendUrl, authHeader]);

  const value = {
    dToken,
    setDToken,
    backendUrl,
    authHeader,
    getAppointments,
    appointments,
    setAppointments,
    completeAppointment,
    cancelAppointment,
    getDashData,
    dashData,
    setDashData,
    getProfileData,
    setProfileData,
    profileData,
  };

  return (
    <DoctorContext.Provider value={value}>
      {props.children}
    </DoctorContext.Provider>
  );
};

export default DoctorContextProvider;
