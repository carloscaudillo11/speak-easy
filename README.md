# Speak Easy Alexa Skill

## Descripción

Speak Easy es una skill de Alexa diseñada para ayudar a los usuarios a practicar palabras de diferentes categorías a través de la repetición y validación de palabras. Utiliza la capacidad de presentación de Alexa para mostrar imágenes y textos, y valida las respuestas del usuario con una función Lambda de AWS.

## Requisitos

- Node.js
- AWS CLI configurado con permisos para Lambda y S3
- Archivos de configuración `slider.json`, `sliderDS.json`, `galery.json` y las fuentes de datos correspondientes en el directorio `datasource`

## Instalación

1. Clona el repositorio:

   ```bash
   git clone https://github.com/carloscaudillo11/speak-easy.git
   cd speak-easy
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Configura las variables de entorno en tu entorno de desarrollo:

   ```bash
   export S3_PERSISTENCE_REGION=tu_region
   export S3_PERSISTENCE_BUCKET=tu_bucket
   ```

## Estructura del Proyecto

- `index.js`: Contiene el código principal de la skill de Alexa.
- `utils.js`: Contiene funciones auxiliares como `getS3PreSignedUrl`.
- `apl/`: Contiene los archivos de presentación APL.
- `datasource/`: Contiene las fuentes de datos para las diferentes categorías.

## Descripción del Código

### `index.js`

Este archivo contiene los handlers principales para manejar diferentes tipos de solicitudes y eventos de usuario en la skill de Alexa.

#### Handlers

- **LaunchRequestHandler**: Maneja la solicitud de lanzamiento de la skill.
- **RebootHandler**: Reinicia la sesión si el atributo `finish` es verdadero.
- **BackEventHandler**: Maneja el evento de retroceso del usuario.
- **AplUserEventHandler**: Maneja eventos de usuario relacionados con interacciones de APL.
- **SelectCategoryIntentHandler**: Maneja la intención de selección de categoría.
- **InitRepeatIntentHandler**: Inicializa la sesión de repetición.
- **RepeatIntentHandler**: Maneja la intención de repetición.
- **HelpIntentHandler**: Proporciona ayuda al usuario.
- **CancelAndStopIntentHandler**: Maneja las intenciones de cancelación y parada.
- **FallbackIntentHandler**: Maneja la intención de fallback cuando el usuario dice algo no reconocido.
- **SessionEndedRequestHandler**: Maneja la solicitud de fin de sesión.
- **IntentReflectorHandler**: Refleja la intención disparada por el usuario, principalmente para depuración.
- **ErrorHandler**: Manejador global de errores para la skill.

### `utils.js`

Contiene una función para obtener una URL pre-firmada de S3:

#### `getS3PreSignedUrl`

```javascript
const AWS = require("aws-sdk");

// Crear un cliente S3 con firma de versión 4
const s3SigV4Client = new AWS.S3({
  signatureVersion: "v4",
  region: process.env.S3_PERSISTENCE_REGION,
});

/**
 * Obtiene una URL pre-firmada de S3 para acceder a un objeto.
 * @param {string} s3ObjectKey - La clave del objeto S3 para el cual se desea obtener la URL pre-firmada.
 * @returns {string} La URL pre-firmada para acceder al objeto S3.
 */
module.exports.getS3PreSignedUrl = function getS3PreSignedUrl(s3ObjectKey) {
  const bucketName = process.env.S3_PERSISTENCE_BUCKET;
  const s3PreSignedUrl = s3SigV4Client.getSignedUrl("getObject", {
    Bucket: bucketName,
    Key: s3ObjectKey,
    Expires: 60 * 1, // El tiempo de expiración está fijado en 1 minuto
  });
  console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
  return s3PreSignedUrl;
};
```

## Uso

Inicia la skill diciendo:

```css
Alexa, open speak easy
```
