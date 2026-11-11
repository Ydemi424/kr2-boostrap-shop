/* Проверки форм и работа с датами. Функции не отправляют данные на сервер. */
'use strict';

const KvestValidation = (() => {
  function localDate(date = new Date()) {
    const year = String(date.getFullYear()).padStart(4, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function timeToMinutes(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      return NaN;
    }

    const [hours, minutes] = value.split(':').map(Number);
    if (hours > 23 || minutes > 59) {
      return NaN;
    }

    return hours * 60 + minutes;
  }

  function isPastSlot(date, time, now = new Date()) {
    const today = localDate(now);
    return date < today || (
      date === today && timeToMinutes(time) <= now.getHours() * 60 + now.getMinutes()
    );
  }

  function suggestedSlot(now = new Date()) {
    const times = ['11:00', '14:00', '17:00', '20:00'];
    const today = localDate(now);
    const next = times.find(time => !isPastSlot(today, time, now));

    if (next) {
      return {
        date: today,
        start: next,
        end: String(Number(next.slice(0, 2)) + 1).padStart(2, '0') + ':00'
      };
    }

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return {date: localDate(tomorrow), start: '11:00', end: '12:00'};
  }

  function nameError(value) {
    const length = value.trim().length;
    if (length < 2) {
      return 'Введите имя: не менее 2 символов.';
    }
    if (length > 80) {
      return 'Имя должно содержать не более 80 символов.';
    }
    return '';
  }

  function validateBooking(values, catalog, now = new Date()) {
    const errors = {};
    const quest = catalog.find(item => item.id === values.quest);
    const name = nameError(values.name);
    if (name) {
      errors['booking-name'] = name;
    }
    if (!quest) {
      errors['booking-quest'] = 'Выберите квест.';
    }

    const phone = values.phone.trim();
    const digits = phone.replace(/\D/g, '');
    if (!/^[+\d\s()-]+$/.test(phone) || digits.length < 10 || digits.length > 15) {
      errors['booking-phone'] = 'Введите телефон: от 10 до 15 цифр. Допустимы +, пробелы, скобки и дефисы.';
    }

    const parsedDate = new Date(values.date + 'T12:00:00');
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(values.date)
      && !Number.isNaN(parsedDate.getTime())
      && localDate(parsedDate) === values.date;

    if (!validDate) {
      errors['booking-date'] = 'Выберите корректную дату игры.';
    } else if (values.date < localDate(now)) {
      errors['booking-date'] = 'Дата игры не может быть в прошлом.';
    }

    const start = timeToMinutes(values.start);
    const end = timeToMinutes(values.end);
    const duration = (end - start) / 60;

    if (!Number.isFinite(start)) {
      errors['booking-start'] = 'Укажите время начала.';
    } else if (start < 600 || start > 1320) {
      errors['booking-start'] = 'Начало игры — с 10:00 до 22:00.';
    } else if (start % 30 !== 0) {
      errors['booking-start'] = 'Выберите время с шагом 30 минут.';
    } else if (values.date === localDate(now) && isPastSlot(values.date, values.start, now)) {
      errors['booking-start'] = 'Для сегодняшней даты выберите время в будущем.';
    }

    if (!Number.isFinite(end)) {
      errors['booking-end'] = 'Укажите время окончания.';
    } else if (Number.isFinite(start) && end <= start) {
      errors['booking-end'] = 'Окончание должно быть позже начала.';
    } else if (Number.isFinite(start) && duration < 1) {
      errors['booking-end'] = 'Минимальная длительность — 1 час.';
    } else if (end < 660 || end > 1380) {
      errors['booking-end'] = 'Окончание игры — с 11:00 до 23:00.';
    } else if (end % 30 !== 0) {
      errors['booking-end'] = 'Выберите время с шагом 30 минут.';
    }

    const players = Number(values.players);
    if (values.players === '' || !Number.isInteger(players)) {
      errors['booking-players'] = 'Укажите целое количество игроков.';
    } else if (quest && (players < quest.minPlayers || players > quest.maxPlayers)) {
      errors['booking-players'] = `Для этого квеста нужна команда от ${quest.minPlayers} до ${quest.maxPlayers} человек.`;
    } else if (players < 1) {
      errors['booking-players'] = 'Количество игроков должно быть положительным.';
    }

    const parameters = ['quest', 'date', 'start', 'end', 'players'];
    const parametersValid = quest && parameters.every(key => !errors['booking-' + key]);
    const total = parametersValid ? quest.price * duration : null;

    return {
      errors,
      quest,
      total,
      duration,
      players,
      valid: Object.keys(errors).length === 0
    };
  }

  return {
    localDate,
    timeToMinutes,
    isPastSlot,
    suggestedSlot,
    validateBooking
  };
})();
