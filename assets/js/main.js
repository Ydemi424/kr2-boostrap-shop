/* KvestLabb: фильтры, расписание, формы и учебные подтверждения. */
'use strict';

(() => {
  const byId = id => document.getElementById(id);
  const number = value => new Intl.NumberFormat('ru-RU').format(value);
  const money = value => number(value) + ' ₽';

  // Фильтры жанра и цены применяются совместно.
  const filterForm = byId('quest-filter-form');
  if (filterForm) {
    const genre = byId('genre-filter');
    const price = byId('price-filter');
    const cards = [...document.querySelectorAll('.quest-item')];

    function filterQuests() {
      let count = 0;
      cards.forEach(card => {
        const genreMatches = genre.value === 'all' || card.dataset.genre === genre.value;
        const priceMatches = Number(card.dataset.price) <= Number(price.value);
        card.hidden = !(genreMatches && priceMatches);
        if (!card.hidden) {
          count++;
        }
      });

      byId('quest-count').textContent = 'Найдено квестов: ' + count;
      byId('quest-empty').hidden = count !== 0;
      byId('price-output').textContent = number(price.value);
      price.setAttribute('aria-valuetext', money(price.value) + ' за команду в час');
    }

    filterForm.addEventListener('input', filterQuests);
    filterForm.addEventListener('submit', event => event.preventDefault());
    filterForm.addEventListener('reset', () => {
      // Браузер восстанавливает значения после события reset.
      setTimeout(filterQuests, 0);
    });
    byId('reset-filters').addEventListener('click', () => filterForm.reset());
    filterQuests();
  }

  // Сообщения всегда находятся под своими полями, без всплывающих alert.
  function showErrors(form, errors) {
    form.querySelectorAll('.invalid-feedback').forEach(message => {
      const fieldId = message.id.replace(/-error$/, '');
      const text = errors[fieldId] || '';
      message.textContent = text;
      const field = byId(fieldId);

      if (field) {
        field.classList.toggle('is-invalid', Boolean(text));
        if (text) {
          field.setAttribute('aria-invalid', 'true');
        } else {
          field.removeAttribute('aria-invalid');
        }
      }

    });
  }

  function focusFirstError(form) {
    const field = form.querySelector('input.is-invalid, select.is-invalid, textarea.is-invalid');
    if (field) {
      field.focus();
    }
  }

  // Один и тот же диалог доступен из шапки, карточки квеста и расписания.
  const bookingModal = byId('booking-modal');
  const bookingForm = byId('booking-form');
  let bookingSubmitted = false;

  function bookingValues() {
    return {
      quest: byId('booking-quest').value,
      name: byId('booking-name').value,
      phone: byId('booking-phone').value,
      date: byId('booking-date').value,
      players: byId('booking-players').value,
      start: byId('booking-start').value,
      end: byId('booking-end').value
    };
  }

  function refreshBooking() {
    byId('booking-date').min = KvestValidation.localDate();
    const result = KvestValidation.validateBooking(bookingValues(), questCatalog);
    const quest = result.quest;
    const players = byId('booking-players');

    if (quest) {
      players.min = String(quest.minPlayers);
      players.max = String(quest.maxPlayers);
      byId('booking-quest-info').textContent = `${quest.age}+ · ${quest.minPlayers}–${quest.maxPlayers} игроков · ${money(quest.price)} за команду / час`;
    } else {
      players.min = '2';
      players.max = '6';
      byId('booking-quest-info').textContent = 'Выберите квест, чтобы увидеть стоимость и размер команды.';
    }

    byId('booking-total').textContent = result.total === null ? '—' : money(result.total);
    byId('booking-breakdown').textContent = result.total === null
      ? 'Выберите корректные квест, дату, время и число игроков'
      : `${money(quest.price)} × ${number(result.duration)} ч`;

    if (bookingSubmitted) {
      showErrors(bookingForm, result.errors);
    }
    return result;
  }

  bookingModal.addEventListener('show.bs.modal', event => {
    bookingForm.reset();
    bookingForm.hidden = false;
    bookingSubmitted = false;
    byId('booking-success').hidden = true;
    byId('booking-details').textContent = '';
    showErrors(bookingForm, {});

    const source = event.relatedTarget;
    const suggested = KvestValidation.suggestedSlot();
    byId('booking-quest').value = source?.dataset.quest || '';
    byId('booking-date').value = source?.dataset.date || suggested.date;
    byId('booking-start').value = source?.dataset.start || suggested.start;
    byId('booking-end').value = source?.dataset.end || suggested.end;
    refreshBooking();
  });

  bookingModal.addEventListener('shown.bs.modal', () => {
    const field = byId('booking-quest').value ? byId('booking-name') : byId('booking-quest');
    field.focus();
  });

  bookingForm.addEventListener('input', refreshBooking);
  bookingForm.addEventListener('submit', event => {
    event.preventDefault();
    bookingSubmitted = true;
    const result = refreshBooking();

    if (!result.valid) {
      focusFirstError(bookingForm);
      return;
    }

    const values = bookingValues();
    const date = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(new Date(values.date + 'T12:00:00'));

    byId('booking-details').textContent = `${result.quest.name}\n${date}\n${values.start}–${values.end} · ${number(result.duration)} ч\nИгроков: ${result.players}\nИтого за команду: ${money(result.total)}`;
    bookingForm.hidden = true;
    byId('booking-success').hidden = false;
    byId('booking-success').querySelector('h3').focus();
  });

  bookingModal.addEventListener('hidden.bs.modal', () => {
    bookingForm.reset();
    byId('booking-details').textContent = '';
  });

  // Расписание строится по местной дате устройства, без фиксированных прошедших дат.
  const schedule = byId('schedule-content');
  if (schedule) {
    let renderedDay = '';
    const sessionTimes = ['11:00', '14:00', '17:00', '20:00'];

    function sessionCard(quest, date) {
      const column = document.createElement('div');
      column.className = 'col-md-6 col-xl-4';

      // В шаблон попадают только собственные данные каталога, не ввод пользователя.
      column.innerHTML = `
        <article class="card session-card">
          <img src="assets/images/${quest.image}.jpg" alt="Атмосферная иллюстрация: ${quest.name}" width="900" height="600" loading="lazy">
          <div class="session-body">
            <span class="quest-genre">${quest.genreLabel} · ${quest.age}+</span>
            <h3>${quest.name}</h3>
            <div class="quest-meta">
              <span>${quest.minPlayers}–${quest.maxPlayers} игроков</span>
              <span>60 минут</span>
            </div>
            <p class="session-price">${money(quest.price)} <small>за команду / час</small></p>
            <div class="slot-grid"></div>
            <p class="slot-note">Выберите начало игры · учебные сеансы</p>
          </div>
        </article>
      `;

      const slots = column.querySelector('.slot-grid');
      sessionTimes.forEach(start => {
        const end = String(Number(start.slice(0, 2)) + 1).padStart(2, '0') + ':00';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'slot-button';
        button.textContent = start;
        button.dataset.bsToggle = 'modal';
        button.dataset.bsTarget = '#booking-modal';
        button.dataset.quest = quest.id;
        button.dataset.date = date;
        button.dataset.start = start;
        button.dataset.end = end;
        button.setAttribute('aria-label', `${quest.name}, ${date}, ${start}–${end}`);
        slots.append(button);
      });

      return column;
    }

    function updateSchedule() {
      const now = new Date();
      const today = KvestValidation.localDate(now);

      if (renderedDay !== today) {
        for (let offset = 0; offset < 3; offset++) {
          const date = new Date(now);
          date.setHours(12, 0, 0, 0);
          date.setDate(date.getDate() + offset);
          const dateValue = KvestValidation.localDate(date);
          byId('date-label-' + offset).textContent = new Intl.DateTimeFormat('ru-RU', {
            weekday: 'short',
            day: 'numeric',
            month: 'short'
          }).format(date);

          const grid = byId('schedule-grid-' + offset);
          grid.replaceChildren();
          questCatalog.forEach(quest => grid.append(sessionCard(quest, dateValue)));
        }
        renderedDay = today;
      }

      schedule.querySelectorAll('.slot-button').forEach(button => {
        button.disabled = KvestValidation.isPastSlot(button.dataset.date, button.dataset.start, now);
        button.title = button.disabled ? 'Этот сеанс уже начался' : 'Открыть учебную заявку';
      });
    }

    updateSchedule();
    byId('date-tabs').addEventListener('shown.bs.tab', updateSchedule);
    setInterval(updateSchedule, 60000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        updateSchedule();
      }
    });
  }

})();
