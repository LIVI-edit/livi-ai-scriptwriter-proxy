function blueprint(overrides = {}) {
  const base = {
    meta: { scriptwriter_role: "creative_director", video_type: "video", language: "ru" },
    goal: { video_topic: "Запуск умного устройства", video_goal: "promotion_ad" },
    scene_core: { seed_scene: "Герой впервые включает устройство.", main_focus: "Момент выбора довериться технологии.", scene_action: "reveal" },
    narrative: { scene_setup: "Тёмная студия до запуска.", scene_development: "Свет устройства меняет пространство." },
    visual_direction: { emotion: "technological" },
    extensions: { camera_details: { enabled: true } },
    system_state: { current_stage: "refinement", known_inputs: { topic: true }, refinement_state: {
      active_anchor: "conflict", open_anchor: true, pending_options: false, options_context: null,
      open_question: false, question_context: null, hold_or_not_ready: false,
      last_user_intent: "actionable_change", anchor_hint: "conflict"
    } }
  };
  return deepMerge(base, overrides);
}
function deepMerge(a,b){const out={...a};for(const [k,v] of Object.entries(b||{})){out[k]=v&&typeof v==="object"&&!Array.isArray(v)&&a[k]&&typeof a[k]==="object"&&!Array.isArray(a[k])?deepMerge(a[k],v):v;}return out;}
function ideas(language="ru") { return { ideas: [
  { slot:"precise", title:language==="en"?"Direct reveal":"Прямое раскрытие", seed_scene:language==="en"?"The device wakes as the hero touches it.":"Устройство оживает от прикосновения героя.", why_it_fits:language==="en"?"Clear product value.":"Ясно показывает ценность продукта." },
  { slot:"variation", title:language==="en"?"Delayed response":"Отложенный отклик", seed_scene:language==="en"?"The room responds before the device lights up.":"Пространство реагирует раньше, чем загорается устройство.", why_it_fits:language==="en"?"Adds anticipation.":"Добавляет ожидание." },
  { slot:"creative", title:language==="en"?"Living signal":"Живой сигнал", seed_scene:language==="en"?"A pulse travels through objects and returns to the hero.":"Импульс проходит через предметы и возвращается к герою.", why_it_fits:language==="en"?"Creates a memorable metaphor.":"Создаёт запоминающуюся метафору." }
]}; }
function selection(language="ru", questions=[]) { return { message: language==="en"?"I’ll keep this scene as the working basis.":"Фиксирую эту сцену как рабочую основу.", questions, patch:{} }; }
function development(language="ru", questions=[]) { return { status:"ok", message: language==="en"?"The hero hesitates, touches the device, and the room answers with a chain of light. You can refine a detail, change the emphasis, confirm this basis, or leave the decision to me.":"Герой сомневается, касается устройства, и помещение отвечает цепочкой света. Можешь уточнить деталь, изменить акцент, подтвердить основу или оставить решение мне.", questions, patch:{ scene_core:{main_focus:language==="en"?"Trust at the moment of activation.":"Доверие в момент запуска."}, narrative:{scene_setup:language==="en"?"The hero stands in a dark studio before an inactive device.":"Герой стоит в тёмной студии перед неактивным устройством.",scene_development:language==="en"?"A touch starts a visible wave that transforms the room.":"Прикосновение запускает видимую волну, меняющую пространство."} } }; }
function refinement(language="ru", overrides={}) { return { message:language==="en"?"I strengthened the current conflict without changing the chosen scene.":"Я усилил текущий конфликт, не меняя выбранную сцену.", user_intent_label:"actionable_change", anchor_hint:"conflict", questions:[], options:[], blueprint_patch:{narrative:{scene_development:language==="en"?"The wave pauses until the hero makes a deliberate second touch.":"Волна замирает, пока герой осознанно не касается устройства снова."}}, ...overrides }; }
function alignment(language="ru") { return { message: language==="en"?"We keep the activation scene as the basis. The main emphasis is the hero’s deliberate choice and the visible response of the space. The result will be a usable video structure with scene logic and production-ready detail. Afterward, the necessary parts can be discussed separately.":"За основу остаётся сцена запуска устройства. Главный акцент — осознанный выбор героя и видимый ответ пространства. Результат будет применимой структурой ролика с логикой сцены и производственными деталями. После этого нужные части можно будет обсудить отдельно.", questions:[] }; }
function buildSchema(){return {version:"1",plan_tier:"pro",video_type:"video",density_mode:"standard",text_budget_total:1200,blocks:["video_overview"],block_character_budget:{video_overview:600},selected_advanced_options:[]};}
module.exports={blueprint,ideas,selection,development,refinement,alignment,buildSchema,deepMerge};
