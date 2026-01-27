import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo'
})
export class TimeAgoPipe implements PipeTransform {
  transform(value: Date | string): string {
    if (!value) {
      return '';
    }

    const date = new Date(value);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) {
      return 'hace unos segundos';
    }

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return minutes === 1 ? 'hace 1 minuto' : `hace ${minutes} minutos`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? 'hace 1 hora' : `hace ${hours} horas`;
    }

    const days = Math.floor(hours / 24);
    if (days < 7) {
      return days === 1 ? 'hace 1 dia' : `hace ${days} dias`;
    }

    const weeks = Math.floor(days / 7);
    if (weeks < 4) {
      return weeks === 1 ? 'hace 1 semana' : `hace ${weeks} semanas`;
    }

    const months = Math.floor(days / 30);
    if (months < 12) {
      return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
    }

    const years = Math.floor(days / 365);
    return years === 1 ? 'hace 1 año' : `hace ${years} años`;
  }
}
