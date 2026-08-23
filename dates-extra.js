(() => {
  function monthDay(text) {
    const clean = text.trim().replace('Sept.', 'Sep').replace('Oct.', 'Oct');
    const parts = clean.split(' ');
    return { month: parts[0].toUpperCase(), day: parts.slice(1).join(' ') };
  }

  function upgradeDates() {
    const section = document.querySelector('section.dates#dates');
    if (!section || section.classList.contains('dates-upgraded')) return;
    const heading = section.querySelector('h2');
    const grid = section.querySelector('.date-grid');
    if (!heading || !grid) return;

    section.classList.add('dates-upgraded');

    const headingRow = document.createElement('div');
    headingRow.className = 'dates-heading-row';
    const headingCopy = document.createElement('div');
    headingCopy.className = 'dates-heading-copy';
    const accent = document.createElement('div');
    accent.className = 'dates-heading-accent';
    headingCopy.append(heading, accent);
    headingRow.append(headingCopy);
    section.insertBefore(headingRow, grid);

    const cards = Array.from(grid.querySelectorAll('.date-card'));
    grid.classList.add('date-timeline');
    cards.forEach((card, index) => {
      const date = card.querySelector('.date')?.textContent || '';
      const title = card.querySelector('h3')?.textContent || '';
      const description = card.querySelector('p')?.textContent || '';
      const { month, day } = monthDay(date);
      const kind = /debate/i.test(title) ? 'Event' : /online/i.test(title) ? 'Online voting' : /advance/i.test(title) ? 'Advance voting' : 'Election day';
      card.className = `card date-card date-stop${index === 0 ? ' is-next' : ''}`;
      card.innerHTML = `
        <div class="date-stop-top">
          <div class="date-calendar" aria-hidden="true">
            <span class="date-calendar-month">${month}</span>
            <span class="date-calendar-day">${day}</span>
          </div>
          <span class="date-status">${index === 0 ? 'Next' : 'Upcoming'}</span>
        </div>
        <div class="date-stop-body">
          <span class="date-kind">${kind}</span>
          <h3>${title}</h3>
          <p>${description}</p>
        </div>`;
    });
  }

  document.addEventListener('DOMContentLoaded', upgradeDates);
})();
