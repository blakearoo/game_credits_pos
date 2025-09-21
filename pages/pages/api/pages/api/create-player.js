import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required' });
  }

  try {
    // Check if username or email already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('players')
      .select('id')
      .or(`username.eq.${username},email.eq.${email}`);

    if (checkError) {
      console.error('Check error:', checkError);
      return res.status(500).json({ message: 'Database error' });
    }

    if (existingUsers && existingUsers.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new player
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        username: username,
        email: email,
        password_hash: passwordHash,
        credits: 0
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      return res.status(500).json({ message: 'Error creating player' });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Player created successfully',
      playerId: newPlayer.id,
      username: newPlayer.username
    });

  } catch (error) {
    console.error('Player creation error:', error);
    res.status(500).json({ message: 'Error creating player' });
  }
}
