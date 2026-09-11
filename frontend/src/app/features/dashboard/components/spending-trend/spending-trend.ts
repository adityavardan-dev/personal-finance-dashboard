import { DecimalPipe } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-spending-trend',
  imports: [DecimalPipe],
  templateUrl: './spending-trend.html',
  styleUrl: './spending-trend.css',
})
export class SpendingTrend {
  selectedRange = 'All';
  categories = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  values = [28600, 31200, 29800, 32500, 34100, 36700];

  get total() {
    return this.values.reduce((sum, value) => sum + value, 0);
  }

  get average() {
    return Math.round(this.total / this.values.length);
  }

  get topMonth() {
    const maxValue = Math.max(...this.values);
    const index = this.values.indexOf(maxValue);
    return `${this.categories[index]} • ₹${maxValue.toLocaleString()}`;
  }

  chartOptions = {
    chart: {
      type: 'area',
      backgroundColor: 'transparent',
    },
    title: {
      text: null,
    },
    xAxis: {
      categories: this.categories,
    },
    yAxis: {
      title: {
        text: 'Amount',
      },
    },
    series: [
      {
        name: 'Spending',
        data: this.values,
      },
    ],
    credits: {
      enabled: false,
    },
  };
}
