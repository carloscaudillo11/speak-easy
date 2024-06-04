const Alexa = require("ask-sdk-core");
const slider = require("./apl/slider.json");
const sliderDS = require("./datasource/sliderDS.json");
const galery = require("./apl/galery.json");
const fs = require("fs");
const path = require("path");
const AWS = require("aws-sdk");
const difflib = require('difflib');

/**
 * Crea una carga útil de directiva para renderizar documentos APL.
 * @param {object} aplDocument - El documento APL a renderizar.
 * @param {object} dataSources - Las fuentes de datos para el documento APL.
 * @param {string} tokenId - Un ID de token único para la directiva.
 * @returns {object} La carga útil de la directiva.
 */
const createDirectivePayload = (aplDocument, dataSources, tokenId) => {
  return {
    type: "Alexa.Presentation.APL.RenderDocument",
    token: tokenId,
    document: aplDocument,
    datasources: dataSources,
  };
};

/**
 * Valida si la respuesta del usuario coincide con una palabra dada utilizando una función Lambda de AWS.
 * @param {string} word - La palabra correcta a comparar.
 * @param {string} userResponse - La respuesta del usuario.
 * @returns {Promise<number|null>} El puntaje de similitud o null si ocurre un error.
 */
const validateWord = async (word, userResponse) => {
  const lambda = new AWS.Lambda();

  const params = {
    FunctionName: "arn:aws:lambda:us-east-2:654654179013:function:algoritmoTEA", // Cambiar el ARN de la función Lambda
    Payload: JSON.stringify({
      palabra1: userResponse.toString(),
      palabra2: word.toString(),
    }),
  };

  try {
    const result = await lambda.invoke(params).promise();
    const payload = JSON.parse(result.Payload);
    const numberResult = parseFloat(payload.body);
    const integerResult = Math.floor(numberResult);
    return integerResult;
  } catch (err) {
    console.error(err);
    return null;
  }
};

/**
 * Este manejador se activa cuando el usuario lanza la skill. Verifica si el tipo de solicitud es "LaunchRequest" y responde con un 
 * mensaje de bienvenida que invita al usuario a seleccionar una categoría. Si el dispositivo del usuario es compatible con APL 
 * (Alexa Presentation Language), se envía una directiva APL que muestra una interfaz de deslizamiento con las categorías disponibles.
 */
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const speak = "Bienvenido a Speak Easy, Selecciona una categoría";
    if (
      Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)[
        "Alexa.Presentation.APL"
      ]
    ) {
      const aplDirective = createDirectivePayload(
        slider,
        sliderDS,
        "categorias"
      );
      handlerInput.responseBuilder.addDirective(aplDirective);
    }

    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt(speak)
      .getResponse();
  },
};

/**
 * Este manejador se activa cuando la sesión del usuario ha finalizado previamente. Verifica si el atributo de sesión finish está establecido 
 * en true. Si es así, restablece este atributo a false y reinicia la skill llamando al LaunchRequestHandler. 
 * Esto permite que la skill vuelva a su estado inicial de bienvenida.
 */
const RebootHandler = {
  canHandle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    return sessionAttributes.finish === true;
  },
  handle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    sessionAttributes.finish = false;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    return LaunchRequestHandler.handle(handlerInput);
  },
};

/**
 * Este manejador se activa cuando el usuario interactúa con un componente APL y selecciona la opción "goBack". Verifica si el evento es un 
 * "UserEvent" de APL y si el argumento es "goBack". Si se cumplen estas condiciones, vuelve a lanzar la skill utilizando el LaunchRequestHandler, 
 * lo que lleva al usuario de vuelta al menú principal.
 */
const BackEventHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "Alexa.Presentation.APL.UserEvent" &&
      request.arguments[0] === "goBack"
    );
  },
  handle(handlerInput) {
    return LaunchRequestHandler.handle(handlerInput);
  },
};

/**
 * Este manejador se activa cuando el usuario interactúa con una interfaz APL específica (en este caso, con el token "categorias"). Extrae la categoría 
 * seleccionada por el usuario del evento, la guarda en los atributos de sesión y responde con un mensaje confirmando la selección de la categoría. Luego, 
 * carga los datos específicos de la categoría seleccionada desde un archivo JSON y, si el dispositivo es compatible con APL, muestra una galería correspondiente 
 * a la categoría seleccionada.
 */
const AplUserEventHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (
      request.type === "Alexa.Presentation.APL.UserEvent" &&
      request.token === "categorias"
    );
  },
  handle(handlerInput) {
    const category = handlerInput.requestEnvelope.request.arguments[0];
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    let categorySlotValue;

    if (!category) {
      const speakOutput =
        "Lo siento, no pude detectar la categoría. Por favor, intenta nuevamente.";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      categorySlotValue = category;
    }

    const speak = `¡Has seleccionado la categoría ${categorySlotValue}!, ¿Estas Listo?`;
    const dataSourceFile = path.join(
      __dirname,
      "datasource",
      `${categorySlotValue}DS.json`
    );
    const dataSource = JSON.parse(fs.readFileSync(dataSourceFile, "utf8"));
    if (
      Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)[
        "Alexa.Presentation.APL"
      ]
    ) {
      const aplDirective = createDirectivePayload(
        galery,
        dataSource,
        "galeria"
      );
      handlerInput.responseBuilder.addDirective(aplDirective);
    }

    sessionAttributes.currentDataSource = dataSource;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt(speak)
      .getResponse();
  },
};

/**
 * Este manejador se activa cuando el usuario selecciona una categoría utilizando un intent específico (SelectCategoryIntent). Verifica si la solicitud es del 
 * tipo "IntentRequest" y si el intent es "SelectCategoryIntent". Luego, obtiene la categoría del slot correspondiente, la guarda en los atributos de sesión y 
 * responde con un mensaje confirmando la selección. Además, carga los datos específicos de la categoría desde un archivo JSON y muestra una galería APL si el 
 * dispositivo es compatible.
 */
const SelectCategoryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "SelectCategoryIntent"
    );
  },
  handle(handlerInput) {
    const categorySlot = Alexa.getSlot(
      handlerInput.requestEnvelope,
      "category"
    );
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    let categorySlotValue;

    if (!categorySlot || !categorySlot.value) {
      const speakOutput =
        "Lo siento, no pude detectar la categoría. Por favor, intenta nuevamente.";
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      categorySlotValue = categorySlot.value.toLowerCase();
    }

    const speak = `¡Has seleccionado la categoría ${categorySlotValue}!, ¿Estas Listo?`;
    const dataSourceFile = path.join(
      __dirname,
      "datasource",
      `${categorySlotValue}DS.json`
    );
    const dataSource = JSON.parse(fs.readFileSync(dataSourceFile, "utf8"));
    if (
      Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)[
        "Alexa.Presentation.APL"
      ]
    ) {
      const aplDirective = createDirectivePayload(
        galery,
        dataSource,
        "galeria"
      );
      handlerInput.responseBuilder.addDirective(aplDirective);
    }

    sessionAttributes.currentDataSource = dataSource;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speak)
      .reprompt(speak)
      .getResponse();
  },
};

/**
 * Este manejador se activa cuando el usuario inicia una sesión de repetición utilizando el intent "InitRepeatIntent". Verifica si la solicitud es del tipo "IntentRequest" 
 * y si el intent es "InitRepeatIntent". Luego, inicializa el índice de la imagen actual y guarda la primera imagen de la lista en los atributos de sesión. Responde con un 
 * mensaje que describe la imagen y pide al usuario que diga lo que ve en la imagen. También establece un atributo de sesión para indicar que la repetición ha comenzado.
 */
const InitRepeatIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "InitRepeatIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    const currentDataSource = sessionAttributes.currentDataSource;
    const currentImageIndex = 0;
    const currentImage =
      currentDataSource.imageListData.listItems[currentImageIndex];

    sessionAttributes.currentImageIndex = currentImageIndex;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    sessionAttributes.currentImage = currentImage;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    const speakOutput = `Vamos a empezar. ¿Qué ves en la imagen?: ${currentImage.secondaryText}.`;
    sessionAttributes.repeatStarted = true;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

/**
 * Este manejador se activa cuando el usuario repite una palabra utilizando el intent "RepeatIntent". Verifica si la solicitud es del tipo "IntentRequest" y 
 * si el intent es "RepeatIntent". Obtiene la palabra del slot correspondiente y la compara con la palabra actual de la imagen utilizando una función Lambda de AWS. 
 * Si la similitud es mayor a un umbral definido (50%), avanza a la siguiente imagen y pide al usuario que repita la nueva palabra. Si no, pide al usuario que repita 
 * la palabra actual. Si el usuario ha completado todas las imágenes, felicita al usuario y finaliza la sesión.
 */
const RepeatIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "RepeatIntent"
    );
  },
  async handle(handlerInput) {
    const sessionAttributes =
      handlerInput.attributesManager.getSessionAttributes();
    const { currentDataSource, currentImageIndex } = sessionAttributes;

    if (!currentDataSource || currentImageIndex === undefined) {
      const errorMessage =
        "Lo siento, no tengo datos para repetir en este momento.";
      return handlerInput.responseBuilder.speak(errorMessage).getResponse();
    }

    const word = Alexa.getSlotValue(handlerInput.requestEnvelope, "word");
    const currentWord =
      currentDataSource.imageListData.listItems[currentImageIndex]
        .secondaryText;
    const result = await validateWord(currentWord, word);

    if (result !== null && result > 50) {
      const nextImageIndex =
        (currentImageIndex + 1) %
        currentDataSource.imageListData.listItems.length;

      if (nextImageIndex === 0) {
        const speakFinish = "¡¡¡Felicidades!!!, haz terminado";
        sessionAttributes.finish = true;
        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return handlerInput.responseBuilder.speak(speakFinish).getResponse();
      }

      const nextImage =
        currentDataSource.imageListData.listItems[nextImageIndex];
      const speakOutput = `¡Muy bien! Ahora di: ${nextImage.secondaryText}.`;

      sessionAttributes.currentImageIndex = nextImageIndex;
      handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

      const responseBuilder = handlerInput.responseBuilder;

      if (
        Alexa.getSupportedInterfaces(handlerInput.requestEnvelope)[
          "Alexa.Presentation.APL"
        ]
      ) {
        const setPageCommand = {
          type: "SetPage",
          componentId: "mypaginate",
          position: "relative",
          value: 1,
        };

        responseBuilder.addDirective({
          type: "Alexa.Presentation.APL.ExecuteCommands",
          token: "galeria",
          commands: [setPageCommand],
        });
      }

      return responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    } else {
      const speakOutput = `Repite la palabra: ${currentWord}.`;
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(speakOutput)
        .getResponse();
    }
  },
};

/**
 * Este manejador se activa cuando el usuario pide ayuda utilizando el intent "AMAZON.HelpIntent". Verifica si la solicitud es del tipo "IntentRequest" y 
 * si el intent es "AMAZON.HelpIntent". Responde con un mensaje que proporciona instrucciones sobre cómo usar la skill, por ejemplo, cómo seleccionar una 
 * categoría y practicar palabras dentro de esa categoría.
 */
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput =
      "Selecciona una categoría y puedo ayudarte a practicar algunas palabras de esa categoría. Intenta decir selecciona animales";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

/**
 * Maneja las intenciones CancelIntent y StopIntent, finalizando la sesión.
 */
const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speakOutput = "¡Nos vemos pronto!";

    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};

/**
 * Maneja la intención FallbackIntent, activada cuando el usuario dice algo no reconocido.
 */
const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Lo siento, no entendí eso. Intenta de nuevo.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

/**
 * Maneja la solicitud de fin de sesión, que se activa cuando la sesión termina.
 */
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    );
    // Cualquier lógica de limpieza va aquí.
    return handlerInput.responseBuilder.getResponse(); // Nota: enviamos una respuesta vacía
  },
};

/**
 * Refleja la intención disparada por el usuario, principalmente para depuración.
 */
const IntentReflectorHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
    );
  },
  handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `Acabas de activar ${intentName}`;

    return (
      handlerInput.responseBuilder
        .speak(speakOutput)
        //.reprompt('añade una reprompt si deseas mantener la sesión abierta para que el usuario responda')
        .getResponse()
    );
  },
};

/**
 * Este es un manejador global de errores que se activa cuando ocurre cualquier error en la skill. Siempre puede manejar errores, ya que su método 
 * canHandle devuelve true. Responde con un mensaje genérico que indica que hubo un problema al ejecutar la acción solicitada y pide al usuario que 
 * intente nuevamente. También registra el error en la consola para ayudar en la depuración.
 */
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput =
      "Lo siento, tuve un problema al ejecutar la acción que me pediste. Intenta una vez más.";
    console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

/**
 * Configuración del constructor de la skill.
 */
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    BackEventHandler,
    RebootHandler,
    AplUserEventHandler,
    SelectCategoryIntentHandler,
    InitRepeatIntentHandler,
    RepeatIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent("sample/hello-world/v1.2")
  .lambda();
