<script setup lang="ts">
import { withBase } from 'vitepress'
import { data as adrs } from './adr.data'
</script>

<template>
  <table>
    <thead>
      <tr><th>#</th><th>Decision</th><th>Status</th><th>Date</th></tr>
    </thead>
    <tbody>
      <tr v-for="a in adrs" :key="a.number">
        <td>{{ a.number }}</td>
        <td><a :href="withBase(a.url)">{{ a.title }}</a></td>
        <td>{{ a.status }}</td>
        <td>{{ a.date }}</td>
      </tr>
    </tbody>
  </table>
</template>
