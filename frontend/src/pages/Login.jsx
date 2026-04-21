import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { toast } from 'react-toastify'
import { useNavigate } from 'react-router-dom'

const Login = () => {
  const { backendUrl, token, setToken } = useContext(AppContext)
  const [loginType, setLoginType] = useState('User')
  const [state, setState] = useState('Sign Up')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const navigate = useNavigate()

  const onSubmitHandler = async (event) => {
    event.preventDefault();
    if (loginType === 'Admin') {
      window.location.href = import.meta.env.VITE_ADMIN_URL || 'http://localhost:5174'
      return
    }
    try{
    if (state === 'Sign Up') {

      const { data } = await axios.post(backendUrl + '/api/user/register', { name, email, password })

      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
      } else {
        toast.error(data.message)
      }

    } else {

      const { data } = await axios.post(backendUrl + '/api/user/login', { email, password })

      if (data.success) {
        localStorage.setItem('token', data.token)
        setToken(data.token)
      } else {
        toast.error(data.message)
      }

    }}catch(error){
      toast.error(error.message)
    }

  }

  useEffect(() => {
    if (token) {
      navigate('/')
    }
  }, [token, navigate])

  return (
    <form onSubmit={onSubmitHandler} className='min-h-[80vh] flex items-center'>
      <div className='flex flex-col gap-3 m-auto items-start p-8 min-w-[340px] sm:min-w-96 border rounded-xl text-[#5E5E5E] text-sm shadow-lg'>
        <div className='w-full flex rounded-md border border-[#DADADA] overflow-hidden mb-1'>
          <button
            type='button'
            onClick={() => setLoginType('User')}
            className={`w-1/2 py-2 ${loginType === 'User' ? 'bg-primary text-white' : 'bg-white text-[#5E5E5E]'}`}
          >
            User
          </button>
          <button
            type='button'
            onClick={() => setLoginType('Admin')}
            className={`w-1/2 py-2 ${loginType === 'Admin' ? 'bg-primary text-white' : 'bg-white text-[#5E5E5E]'}`}
          >
            Admin
          </button>
        </div>

        {loginType === 'Admin' && (
          <p className='text-xs text-gray-500'>Admin login is handled in the admin panel.</p>
        )}

        <p className='text-2xl font-semibold'>{state === 'Sign Up' ? 'Create Account' : 'Login'}</p>
        <p>
          {loginType === 'User'
            ? `Please ${state === 'Sign Up' ? 'sign up' : 'log in'} to book appointment`
            : 'Continue to admin panel login'}
        </p>
        {loginType === 'User' && state === 'Sign Up'
          ? <div className='w-full '>
            <p>Full Name</p>
            <input onChange={(e) => setName(e.target.value)} value={name} className='border border-[#DADADA] rounded w-full p-2 mt-1' type="text" required />
          </div>
          : null
        }
        {loginType === 'User' && <div className='w-full '>
          <p>Email</p>
          <input onChange={(e) => setEmail(e.target.value)} value={email} className='border border-[#DADADA] rounded w-full p-2 mt-1' type="email" required />
        </div>}
        {loginType === 'User' && <div className='w-full '>
          <p>Password</p>
          <input onChange={(e) => setPassword(e.target.value)} value={password} className='border border-[#DADADA] rounded w-full p-2 mt-1' type="password" required />
        </div>}
        <button type='submit' className='bg-primary text-white w-full py-2 my-2 rounded-md text-base'>
          {loginType === 'Admin' ? 'Go to Admin Login' : state === 'Sign Up' ? 'Create account' : 'Login'}
        </button>
        {loginType === 'User' && (state === 'Sign Up'
          ? <p>Already have an account? <span onClick={() => setState('Login')} className='text-primary underline cursor-pointer'>Login here</span></p>
          : <p>Create an new account? <span onClick={() => setState('Sign Up')} className='text-primary underline cursor-pointer'>Click here</span></p>
        )}
      </div>
    </form>
  )
}

export default Login