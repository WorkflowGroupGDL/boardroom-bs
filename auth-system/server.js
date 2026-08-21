import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Endpoint de login
app.post('/api/login', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'El correo es requerido.' });
    }

    const token = process.env.HUBSPOT_TOKEN;

    if (!token) {
      console.error('ERROR: HUBSPOT_TOKEN no está definido en process.env');
      return res.status(500).json({ success: false, message: 'Configuración del servidor incompleta (Token no configurado).' });
    }

    // Consulta a la API de HubSpot
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Contacto no encontrado en HubSpot.',
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      contact: {
        id: data.id,
        firstname: data.properties?.firstname || '',
        lastname: data.properties?.lastname || '',
        email: data.properties?.email || email
      }
    });

  } catch (error) {
    console.error('Error en /api/login:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// EXPORTAR APP PARA VERCEL (OBLIGATORIO)

// Solo escuchar puerto si se ejecuta localmente (npm start)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor local corriendo en http://localhost:${PORT}`);
  });
}
export default app;