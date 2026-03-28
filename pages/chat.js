import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/router'
import ChatBox from '../components/ChatBox'

export default function Chat() {
  const router = useRouter()

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) router.push('/')
    }

    checkUser()
  }, [])

  return (
    <div style={{ padding: 40 }}>
      <h1>Assistente Vivanexa</h1>
      <ChatBox />
    </div>
  )
}