import { Component } from '@angular/core';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  greeting = 'Good Afternoon, Aditya';
  today = 'Tuesday, 5 August';
}
