const AWS = require('aws-sdk');

// Crear un cliente S3 con firma de versión 4
const s3SigV4Client = new AWS.S3({
    signatureVersion: 'v4',
    region: process.env.S3_PERSISTENCE_REGION
});

/**
 * Obtiene una URL pre-firmada de S3 para acceder a un objeto.
 * @param {string} s3ObjectKey - La clave del objeto S3 para el cual se desea obtener la URL pre-firmada.
 * @returns {string} La URL pre-firmada para acceder al objeto S3.
 */
module.exports.getS3PreSignedUrl = function getS3PreSignedUrl(s3ObjectKey) {

    const bucketName = process.env.S3_PERSISTENCE_BUCKET; // Nombre del bucket de S3
    const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: s3ObjectKey,
        Expires: 60 * 1 // El tiempo de expiración está fijado en 1 minuto
    });
    console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
    return s3PreSignedUrl;
}